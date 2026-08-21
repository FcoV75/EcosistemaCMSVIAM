"""Pruebas del mezclador de rieles de locución y fondo."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from audio_rieles import VOLUMEN_FONDO_DEFAULT, comando_mezcla_rieles


class AudioRielesTests(unittest.TestCase):
    def test_comando_incluye_ambos_rieles_y_amix(self):
        cmd = comando_mezcla_rieles("ffmpeg", "/tmp/voz.mp3", "/tmp/fondo.mp3", "/tmp/out.mp3", 30, 0.24)
        self.assertEqual(cmd[0], "ffmpeg")
        self.assertIn("/tmp/voz.mp3", cmd)
        self.assertIn("/tmp/fondo.mp3", cmd)
        filtro = cmd[cmd.index("-filter_complex") + 1]
        self.assertIn("amix=inputs=2:duration=first", filtro)
        self.assertIn("aloop=", filtro)
        self.assertIn("volume=0.240", filtro)
        self.assertIn("-t", cmd)
        self.assertIn("30.000", cmd)

    def test_volumen_fondo_se_acota(self):
        cmd = comando_mezcla_rieles("ffmpeg", "a", "b", "c", volumen_fondo=9)
        filtro = cmd[cmd.index("-filter_complex") + 1]
        self.assertIn(f"volume=0.600", filtro)
        cmd2 = comando_mezcla_rieles("ffmpeg", "a", "b", "c", volumen_fondo=0)
        filtro2 = cmd2[cmd2.index("-filter_complex") + 1]
        self.assertIn("volume=0.040", filtro2)

    def test_volumen_default_es_discreto(self):
        self.assertGreater(VOLUMEN_FONDO_DEFAULT, 0.1)
        self.assertLess(VOLUMEN_FONDO_DEFAULT, 0.35)
