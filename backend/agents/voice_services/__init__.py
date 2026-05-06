"""Custom speech services for manim-voiceover.

The persona voice cast targets MiniMax Speech-02. The MiniMaxService class
in this package implements the manim-voiceover SpeechService interface so
the Manim render pipeline can call MiniMax's text-to-audio API directly.
"""

from .minimax import MiniMaxService

__all__ = ["MiniMaxService"]
