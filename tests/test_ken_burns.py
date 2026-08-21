"""Pruebas del recuadro Ken Burns (sin OpenCV)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ken_burns import recuadro_ken_burns

WIDTH, HEIGHT = 1280, 720


class KenBurnsTests(unittest.TestCase):
    def test_zoom_in_empieza_abierto_y_cierra(self):
        bw, bh = int(WIDTH * 1.22), int(HEIGHT * 1.22)
        x0, y0, w0, h0 = recuadro_ken_burns(0, "zoom_in", bw, bh, WIDTH, HEIGHT)
        x1, y1, w1, h1 = recuadro_ken_burns(1, "zoom_in", bw, bh, WIDTH, HEIGHT)
        self.assertEqual((w0, h0), (bw, bh))
        self.assertEqual((w1, h1), (WIDTH, HEIGHT))
        self.assertGreaterEqual(x0, 0)
        self.assertGreaterEqual(y1, 0)
        self.assertGreater(w0, w1)
        self.assertGreater(h0, h1)

    def test_zoom_out_es_inverso(self):
        bw, bh = int(WIDTH * 1.22), int(HEIGHT * 1.22)
        _, _, w_in_end, _ = recuadro_ken_burns(1, "zoom_in", bw, bh, WIDTH, HEIGHT)
        _, _, w_out_start, _ = recuadro_ken_burns(0, "zoom_out", bw, bh, WIDTH, HEIGHT)
        self.assertEqual(w_in_end, w_out_start)

    def test_pan_derecha_avanza_en_x(self):
        bw, bh = int(WIDTH * 1.22), int(HEIGHT * 1.22)
        x0, _, w0, h0 = recuadro_ken_burns(0, "pan_derecha", bw, bh, WIDTH, HEIGHT)
        x1, _, w1, h1 = recuadro_ken_burns(1, "pan_derecha", bw, bh, WIDTH, HEIGHT)
        self.assertEqual((w0, h0, w1, h1), (WIDTH, HEIGHT, WIDTH, HEIGHT))
        self.assertEqual(x0, 0)
        self.assertGreater(x1, x0)

    def test_pan_izquierda_retrocede(self):
        bw, bh = int(WIDTH * 1.22), int(HEIGHT * 1.22)
        x0, _, _, _ = recuadro_ken_burns(0, "pan_izquierda", bw, bh, WIDTH, HEIGHT)
        x1, _, _, _ = recuadro_ken_burns(1, "pan_izquierda", bw, bh, WIDTH, HEIGHT)
        self.assertGreater(x0, x1)


if __name__ == "__main__":
    unittest.main()
