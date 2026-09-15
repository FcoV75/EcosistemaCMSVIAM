"""Verifica que la escala tipográfica actualiza los tamaños usados al estampar."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import generador_videos as gv


def test_escala_actualiza_globals_y_estampado():
    gv._aplicar_escala_tipografia(1.0)
    assert gv.TAM_SUBTITULO == 40
    assert gv.TAM_TEXTO_ESCENA == 36
    assert gv.TAM_LEYENDA_PORTADA == 38

    gv._aplicar_escala_tipografia(6.0)
    assert gv.TAM_SUBTITULO == 240
    assert gv.TAM_TEXTO_ESCENA == 216
    assert gv.TAM_LEYENDA_PORTADA == 228
    # Pista intencionalmente limitada
    assert gv.TAM_NOMBRE_PISTA == max(26, int(18 * 2.6))

    # Defaults de firma ya no congelan el tamaño: sin pasar tamano usa el global vivo.
    import numpy as np

    frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    out = gv.estampar_leyenda_grande(frame, "XXL", 1280, 720)
    assert out is not None
    assert out.shape == (720, 1280, 3)

    gv._aplicar_escala_tipografia(2.0)
    assert gv.TAM_SUBTITULO == 80
    out2 = gv.estampar_texto_escena(frame, "Escena M", 1280, 720)
    assert out2 is not None


if __name__ == "__main__":
    test_escala_actualiza_globals_y_estampado()
    print("tipografia escala ok")
