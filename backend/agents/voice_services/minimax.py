"""MiniMax Speech-02 TTS service for manim-voiceover.

Implements the SpeechService interface so manim-voiceover can call MiniMax's
text-to-audio API for persona narration.

API reference: https://www.minimaxi.com/document/guides/T2A-V2

Required environment variables:
    MINIMAX_API_KEY: bearer token issued by MiniMax (api.minimaxi.chat)
    MINIMAX_GROUP_ID: group ID associated with the API key

Optional:
    MINIMAX_VOICE_ID: voice preset (defaults to "male-qn-qingse" — calm tutor voice)
    MINIMAX_MODEL:    "speech-02-hd" (default, highest quality) or "speech-02-turbo"

Persona voice IDs used by Feynman & Friends:
    feynman: "male-qn-qingse"  (warm, contemplative)
    skeptic: "male-qn-jingying" (sharp, analytical)
    newbie:  "female-shaonv"   (curious, asking-questions cadence)
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import httpx

try:
    from manim_voiceover.services.base import SpeechService
except ImportError:  # pragma: no cover — only required at render time
    SpeechService = object  # type: ignore[assignment,misc]


MINIMAX_T2A_URL = "https://api.minimaxi.chat/v1/t2a_v2"

PERSONA_VOICES: dict[str, str] = {
    "feynman": "male-qn-qingse",
    "skeptic": "male-qn-jingying",
    "newbie": "female-shaonv",
}


class MiniMaxService(SpeechService):  # type: ignore[misc]
    """manim-voiceover SpeechService backed by MiniMax Speech-02.

    Wires the same callable surface (`generate_from_text`) that GTTSService
    exposes, so swapping providers is a one-line change in
    `voiceover_generator.py`.

    Example:
        from manim_voiceover import VoiceoverScene
        from backend.agents.voice_services import MiniMaxService

        class MyScene(VoiceoverScene):
            def construct(self):
                self.set_speech_service(
                    MiniMaxService(persona="feynman", model="speech-02-hd")
                )
                with self.voiceover("Welcome to the paper.") as tracker:
                    ...
    """

    def __init__(
        self,
        api_key: str | None = None,
        group_id: str | None = None,
        voice_id: str | None = None,
        persona: str | None = None,
        model: str = "speech-02-hd",
        speed: float = 1.0,
        volume: float = 1.0,
        sample_rate: int = 32000,
        bitrate: int = 128000,
        transcription_model: Any = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(transcription_model=transcription_model, **kwargs)
        self.api_key = api_key or os.environ.get("MINIMAX_API_KEY")
        self.group_id = group_id or os.environ.get("MINIMAX_GROUP_ID")
        if persona and not voice_id:
            voice_id = PERSONA_VOICES.get(persona.lower())
        self.voice_id = (
            voice_id
            or os.environ.get("MINIMAX_VOICE_ID")
            or PERSONA_VOICES["feynman"]
        )
        self.model = model or os.environ.get("MINIMAX_MODEL", "speech-02-hd")
        self.speed = speed
        self.volume = volume
        self.sample_rate = sample_rate
        self.bitrate = bitrate

        if not self.api_key:
            raise RuntimeError(
                "MINIMAX_API_KEY is required for MiniMaxService. Set it in the "
                "environment or pass api_key= explicitly."
            )
        if not self.group_id:
            raise RuntimeError(
                "MINIMAX_GROUP_ID is required for MiniMaxService. Set it in the "
                "environment or pass group_id= explicitly."
            )

    # ------------------------------------------------------------------
    # SpeechService API
    # ------------------------------------------------------------------
    def generate_from_text(
        self,
        text: str,
        cache_dir: str | None = None,
        path: str | None = None,
    ) -> dict[str, Any]:
        """Synthesise `text` to an MP3 file and return manim-voiceover metadata."""
        cache_root = Path(cache_dir) if cache_dir else Path.cwd() / "media" / "voiceovers"
        cache_root.mkdir(parents=True, exist_ok=True)

        input_data = {
            "input_text": text,
            "service": "minimax",
            "config": {
                "model": self.model,
                "voice_id": self.voice_id,
                "speed": self.speed,
                "volume": self.volume,
                "sample_rate": self.sample_rate,
                "bitrate": self.bitrate,
            },
        }

        cached_path = self.get_cached_result(input_data, cache_root)
        if cached_path is not None:
            return cached_path

        audio_path = path or str(self.get_audio_basename(input_data) + ".mp3")
        audio_full = cache_root / Path(audio_path).name

        audio_bytes = self._call_minimax(text)
        audio_full.write_bytes(audio_bytes)

        json_dict: dict[str, Any] = {
            "input_text": text,
            "input_data": input_data,
            "original_audio": audio_full.name,
            "final_audio": audio_full.name,
        }
        return json_dict

    # ------------------------------------------------------------------
    # MiniMax HTTP call
    # ------------------------------------------------------------------
    def _call_minimax(self, text: str) -> bytes:
        """Invoke MiniMax T2A v2 and return raw audio bytes."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {
            "model": self.model,
            "text": text,
            "stream": False,
            "voice_setting": {
                "voice_id": self.voice_id,
                "speed": self.speed,
                "vol": self.volume,
            },
            "audio_setting": {
                "sample_rate": self.sample_rate,
                "bitrate": self.bitrate,
                "format": "mp3",
                "channel": 1,
            },
        }
        url = f"{MINIMAX_T2A_URL}?GroupId={self.group_id}"
        with httpx.Client(timeout=60.0) as client:
            response = client.post(url, headers=headers, content=json.dumps(payload))
        if response.status_code != 200:
            raise RuntimeError(
                f"MiniMax T2A request failed: {response.status_code} {response.text}"
            )
        body = response.json()
        # MiniMax returns hex-encoded audio in `data.audio`
        audio_hex = body.get("data", {}).get("audio")
        if not audio_hex:
            raise RuntimeError(
                f"MiniMax response missing audio payload: {body}"
            )
        return bytes.fromhex(audio_hex)
