"""Pruebas del mezclador de rieles de locución y fondo."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from audio_rieles import VOLUMEN_FONDO_DEFAULT, comando_mezcla_rieles, comandos_mezcla_rieles


class AudioRielesTests(unittest.TestCase):
    def test_comando_incluye_ambos_rieles_y_amix(self):
        cmd = comando_mezcla_rieles("ffmpeg", "/tmp/voz.mp3", "/tmp/fondo.mp3", "/tmp/out.mp3", 30, 0.48)
        self.assertEqual(cmd[0], "ffmpeg")
        self.assertIn("/tmp/voz.mp3", cmd)
        self.assertIn("/tmp/fondo.mp3", cmd)
        self.assertIn("-stream_loop", cmd)
        filtro = cmd[cmd.index("-filter_complex") + 1]
        self.assertIn("amix=inputs=2:duration=first", filtro)
        self.assertIn("normalize=0", filtro)
        self.assertNotIn("aloop=", filtro)
        self.assertIn("volume=0.480", filtro)
        self.assertIn("-t", cmd)
        self.assertIn("30.000", cmd)

    def test_varias_estrategias_si_falla_lame(self):
        cmds = comandos_mezcla_rieles("ffmpeg", "a", "b", "c")
        self.assertGreaterEqual(len(cmds), 3)
        unidos = " ".join(" ".join(c) for c in cmds)
        self.assertIn("libmp3lame", unidos)
        self.assertIn("aac", unidos)

    def test_volumen_fondo_se_acota(self):
        cmd = comando_mezcla_rieles("ffmpeg", "a", "b", "c", volumen_fondo=9)
        filtro = cmd[cmd.index("-filter_complex") + 1]
        self.assertIn("volume=1.000", filtro)
        cmd2 = comando_mezcla_rieles("ffmpeg", "a", "b", "c", volumen_fondo=0)
        filtro2 = cmd2[cmd2.index("-filter_complex") + 1]
        self.assertIn("volume=0.000", filtro2)

    def test_volumen_default_se_oye(self):
        self.assertGreaterEqual(VOLUMEN_FONDO_DEFAULT, 0.4)
        self.assertLessEqual(VOLUMEN_FONDO_DEFAULT, 0.65)
