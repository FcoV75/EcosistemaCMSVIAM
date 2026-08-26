"""Pruebas del recuadro Ken Burns (sin OpenCV)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ken_burns import progreso_ken_burns, quiere_movimiento, recuadro_ken_burns

WIDTH, HEIGHT = 1280, 720


class KenBurnsTests(unittest.TestCase):
    def test_zoom_in_empieza_abierto_y_cierra(self):
        bw, bh = int(WIDTH * 1.62), int(HEIGHT * 1.62)
        x0, y0, w0, h0 = recuadro_ken_burns(0, "zoom_in", bw, bh, WIDTH, HEIGHT)
        x1, y1, w1, h1 = recuadro_ken_burns(1, "zoom_in", bw, bh, WIDTH, HEIGHT)
        self.assertEqual((w0, h0), (bw, bh))
        self.assertEqual((w1, h1), (WIDTH, HEIGHT))
        self.assertGreaterEqual(x0, 0)
        self.assertGreaterEqual(y1, 0)
        self.assertGreater(w0, w1)
        self.assertGreater(h0, h1)

    def test_zoom_out_es_inverso(self):
        bw, bh = int(WIDTH * 1.62), int(HEIGHT * 1.62)
        _, _, w_in_end, _ = recuadro_ken_burns(1, "zoom_in", bw, bh, WIDTH, HEIGHT)
        _, _, w_out_start, _ = recuadro_ken_burns(0, "zoom_out", bw, bh, WIDTH, HEIGHT)
        self.assertEqual(w_in_end, w_out_start)

    def test_pan_derecha_avanza_en_x(self):
        bw, bh = int(WIDTH * 1.62), int(HEIGHT * 1.62)
        x0, _, w0, h0 = recuadro_ken_burns(0, "pan_derecha", bw, bh, WIDTH, HEIGHT)
        x1, _, w1, h1 = recuadro_ken_burns(1, "pan_derecha", bw, bh, WIDTH, HEIGHT)
        self.assertEqual((w0, h0, w1, h1), (WIDTH, HEIGHT, WIDTH, HEIGHT))
        self.assertEqual(x0, 0)
        self.assertGreater(x1, x0)

    def test_pan_izquierda_retrocede(self):
        bw, bh = int(WIDTH * 1.62), int(HEIGHT * 1.62)
        x0, _, _, _ = recuadro_ken_burns(0, "pan_izquierda", bw, bh, WIDTH, HEIGHT)
        x1, _, _, _ = recuadro_ken_burns(1, "pan_izquierda", bw, bh, WIDTH, HEIGHT)
        self.assertGreater(x0, x1)

    def test_progreso_ciclo_de_8s_se_nota(self):
        self.assertEqual(progreso_ken_burns(0, 24, 8), 0)
        self.assertAlmostEqual(progreso_ken_burns(24 * 6, 24, 6), 1.0, places=5)
        self.assertAlmostEqual(progreso_ken_burns(24 * 12, 24, 6), 0.0, places=5)
        self.assertGreater(progreso_ken_burns(24 * 3, 24, 6), 0.4)
        self.assertLess(progreso_ken_burns(24 * 3, 24, 6), 0.6)

    def test_ciclo_de_la_toma_recorre_casi_todo_el_zoom(self):
        fps = 24
        n = 48
        ciclo = n / fps
        self.assertEqual(progreso_ken_burns(0, fps, ciclo), 0)
        self.assertGreater(progreso_ken_burns(n - 1, fps, ciclo), 0.9)

    def test_pan_arriba_y_abajo(self):
        bw, bh = int(WIDTH * 1.62), int(HEIGHT * 1.62)
        _, y0, _, _ = recuadro_ken_burns(0, "pan_abajo", bw, bh, WIDTH, HEIGHT)
        _, y1, _, _ = recuadro_ken_burns(1, "pan_abajo", bw, bh, WIDTH, HEIGHT)
        self.assertGreater(y1, y0)
        _, yu0, _, _ = recuadro_ken_burns(0, "pan_arriba", bw, bh, WIDTH, HEIGHT)
        _, yu1, _, _ = recuadro_ken_burns(1, "pan_arriba", bw, bh, WIDTH, HEIGHT)
        self.assertGreater(yu0, yu1)

    def test_ken_burns_diagonal_zoom_y_pan(self):
        bw, bh = int(WIDTH * 1.62), int(HEIGHT * 1.62)
        x0, y0, w0, h0 = recuadro_ken_burns(0, "ken_burns", bw, bh, WIDTH, HEIGHT)
        x1, y1, w1, h1 = recuadro_ken_burns(1, "ken_burns", bw, bh, WIDTH, HEIGHT)
        self.assertGreater(w0, w1)
        self.assertGreater(h0, h1)
        self.assertGreaterEqual(x1, x0)

    def test_diez_estilos(self):
        from ken_burns import ESTILOS_MOVIMIENTO
        self.assertGreaterEqual(len(ESTILOS_MOVIMIENTO), 10)

    def test_quiere_movimiento_acepta_json_y_texto(self):
        self.assertTrue(quiere_movimiento(True))
        self.assertTrue(quiere_movimiento("true"))
        self.assertTrue(quiere_movimiento("1"))
        self.assertFalse(quiere_movimiento(False))
        self.assertFalse(quiere_movimiento("false"))
        self.assertFalse(quiere_movimiento(None))


if __name__ == "__main__":
    unittest.main()
