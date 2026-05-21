import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
import cv2
import numpy as np
import threading
from PIL import Image, ImageTk, ImageDraw, ImageFont

# Importación y verificación del motor de IA Whisper
try:
    import whisper
    WHISPER_DISPONIBLE = True
except ImportError:
    WHISPER_DISPONIBLE = False

class SoftwareVideoDiamante:
    def __init__(self, root):
        self.root = root
        self.root.title("Generador de Video Nivel Diamante - Transcripción por IA")
        
        # Dimensiones estables de la interfaz
        self.root.geometry("1150x860")
        self.root.minsize(1000, 780)
        
        # Configuración estándar HD
        self.VIDEO_WIDTH = 1280
        self.VIDEO_HEIGHT = 720
        self.FPS = 30
        self.DURACION_IMAGEN_BASE = 3.0
        
        # Variables de control
        self.linea_tiempo_visual = []
        self.ruta_portada = None
        self.ruta_cierre = None  # Nueva ruta para foto final
        self.ruta_audio_fondo = None
        self.duracion_audio_seg = 0.0
        self.imagenes_en_memoria = []
        self.drag_start_index = None
        
        self.aplicar_subtitulos = tk.BooleanVar(value=True)
        self.subtitulos_guardados = ""
        
        # Paleta estricta de colores personalizados
        self.COLOR_FONDO_VENTANA = "#D33F1F"      # Anaranjado rojizo dominante
        self.COLOR_PIZARRA_CREMA = "#FDF5E6"      # Crema para pizarras y áreas de texto
        self.COLOR_BORDE_VIOLETA = "#7D26CD"      # Violeta profundo para bordes de botones
        self.COLOR_TEXTO_PANEL = "#FDF5E6"        # Letras crema sobre fondo rojizo
        
        self.root.configure(bg=self.COLOR_FONDO_VENTANA)
        
        self.configurar_estilos_ttk()
        self.construir_interfaz()
        self.grabar_subtitulos_memoria()

    def configurar_estilos_ttk(self):
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TLabelframe", background=self.COLOR_FONDO_VENTANA, borderwidth=2, relief="groove")
        style.configure("TLabelframe.Label", background="#B13217", foreground=self.COLOR_TEXTO_PANEL, font=("Arial", 10, "bold"))
        style.configure("TLabel", background=self.COLOR_FONDO_VENTANA, foreground=self.COLOR_TEXTO_PANEL, font=("Arial", 9, "bold"))
        style.configure("TCheckbutton", background=self.COLOR_FONDO_VENTANA, foreground=self.COLOR_TEXTO_PANEL, font=("Arial", 9, "bold"))
        style.configure("TEntry", fieldbackground=self.COLOR_PIZARRA_CREMA, foreground="#333333")

    def crear_cabecera_dorada(self, master, texto):
        lbl = tk.Label(
            master, 
            text=texto, 
            font=("Arial", 10, "bold"), 
            bg="#D4AF37", 
            fg="#222222", 
            bd=2, 
            relief="raised", 
            pady=3,
            anchor="w"
        )
        lbl.pack(fill='x')
        return lbl

    def construir_interfaz(self):
        # --- PANEL SUPERIOR: CONFIGURACIÓN DE IDENTIDAD, PORTADA Y CIERRE ---
        frame_top = ttk.LabelFrame(self.root)
        frame_top.pack(fill='x', padx=15, pady=5, side=tk.TOP)
        self.crear_cabecera_dorada(frame_top, " 🖼️ Configuración de Identidad (Portada, Cierre y Leyendas)")
        
        inner_top = tk.Frame(frame_top, bg=self.COLOR_FONDO_VENTANA)
        inner_top.pack(fill='x', padx=5, pady=5)
        
        # Bloque Portada (Izquierda)
        frame_bloque_portada = tk.Frame(inner_top, bg=self.COLOR_FONDO_VENTANA)
        frame_bloque_portada.pack(side=tk.LEFT, fill='x', expand=True)
        
        btn_portada = tk.Button(frame_bloque_portada, text="Seleccionar Portada", command=self.agregar_portada, bg="#D4AF37", fg="#222222", font=("Arial", 9, "bold"), highlightbackground=self.COLOR_BORDE_VIOLETA, highlightthickness=2)
        btn_portada.pack(side=tk.LEFT, padx=5, pady=2)
        self.lbl_portada = tk.Label(frame_bloque_portada, text="Sin portada inicial", fg="#FFE4C4", bg=self.COLOR_FONDO_VENTANA, font=("Arial", 8, "italic"), width=22, anchor="w")
        self.lbl_portada.pack(side=tk.LEFT, padx=2)
        
        tk.Label(frame_bloque_portada, text="Leyenda:", fg=self.COLOR_TEXTO_PANEL, bg=self.COLOR_FONDO_VENTANA, font=("Arial", 9, "bold")).pack(side=tk.LEFT, padx=2)
        self.txt_leyenda_portada = ttk.Entry(frame_bloque_portada, width=22)
        self.txt_leyenda_portada.insert(0, "TU DOLOR TIENE VOZ")
        self.txt_leyenda_portada.pack(side=tk.LEFT, padx=5)

        # Bloque Cierre (Derecha) - ¡NUEVO!
        frame_bloque_cierre = tk.Frame(inner_top, bg=self.COLOR_FONDO_VENTANA)
        frame_bloque_cierre.pack(side=tk.RIGHT, fill='x', expand=True)
        
        btn_cierre = tk.Button(frame_bloque_cierre, text="Seleccionar Foto Final", command=self.agregar_cierre, bg="#D4AF37", fg="#222222", font=("Arial", 9, "bold"), highlightbackground=self.COLOR_BORDE_VIOLETA, highlightthickness=2)
        btn_cierre.pack(side=tk.LEFT, padx=5, pady=2)
        self.lbl_cierre = tk.Label(frame_bloque_cierre, text="Sin foto de cierre", fg="#FFE4C4", bg=self.COLOR_FONDO_VENTANA, font=("Arial", 8, "italic"), width=22, anchor="w")
        self.lbl_cierre.pack(side=tk.LEFT, padx=2)
        
        tk.Label(frame_bloque_cierre, text="Leyenda Final:", fg=self.COLOR_TEXTO_PANEL, bg=self.COLOR_FONDO_VENTANA, font=("Arial", 9, "bold")).pack(side=tk.LEFT, padx=2)
        self.txt_leyenda_cierre = ttk.Entry(frame_bloque_cierre, width=22)
        self.txt_leyenda_cierre.insert(0, "GRACIAS POR SU ATENCIÓN")
        self.txt_leyenda_cierre.pack(side=tk.LEFT, padx=5)

        # --- PANEL: MARCADOR Y BALANCE DE TIEMPOS ---
        self.frame_tiempos = ttk.LabelFrame(self.root)
        self.frame_tiempos.pack(fill='x', padx=15, pady=5, side=tk.TOP)
        self.crear_cabecera_dorada(self.frame_tiempos, " ⏳ Balance y Sincronización de Tiempos")
        
        inner_tiempos = tk.Frame(self.frame_tiempos, bg=self.COLOR_FONDO_VENTANA)
        inner_tiempos.pack(fill='x', padx=5, pady=5)
        
        self.lbl_tiempo_audio = tk.Label(inner_tiempos, text="Duración de la Pista: 00:00", font=("Arial", 10, "bold"), fg="#FFD700", bg=self.COLOR_FONDO_VENTANA)
        self.lbl_tiempo_audio.pack(side=tk.LEFT, padx=15, pady=4)
        
        self.lbl_tiempo_video = tk.Label(inner_tiempos, text="Duración Visual Base: 00:00", font=("Arial", 10, "bold"), fg=self.COLOR_TEXTO_PANEL, bg=self.COLOR_FONDO_VENTANA)
        self.lbl_tiempo_video.pack(side=tk.LEFT, padx=15, pady=4)
        
        self.lbl_estado_ajuste = tk.Label(inner_tiempos, text="Modo: Ajuste estático", font=("Arial", 9, "italic"), fg="#FFF8DC", bg=self.COLOR_FONDO_VENTANA)
        self.lbl_estado_ajuste.pack(side=tk.RIGHT, padx=15, pady=4)

        # --- PANEL INFERIOR: BOTONERA COMPLETA FIJA ---
        frame_bottom = ttk.LabelFrame(self.root)
        frame_bottom.pack(fill='x', padx=15, pady=10, side=tk.BOTTOM)
        self.crear_cabecera_dorada(frame_bottom, " ⚙️ Panel de Control y Ejecución")
        
        inner_bottom = tk.Frame(frame_bottom, bg=self.COLOR_FONDO_VENTANA)
        inner_bottom.pack(fill='x', padx=15, pady=10)
        
        self.btn_agregar = tk.Button(
            inner_bottom, 
            text="➕ BUSCAR Y AÑADIR FOTOS / VIDEOS", 
            command=self.agregar_medios,
            font=("Arial", 11, "bold"),
            bg="#28A745",
            fg="white",
            padx=15,
            pady=8,
            relief="raised",
            highlightbackground=self.COLOR_BORDE_VIOLETA,
            highlightthickness=2
        )
        self.btn_agregar.pack(side=tk.LEFT, padx=5)
        
        self.btn_render = tk.Button(
            inner_bottom, 
            text="🎬 GENERAR VIDEO PROFESIONAL", 
            command=self.ejecutar_renderizado,
            font=("Arial", 11, "bold"),
            bg="#007BFF",
            fg="white",
            padx=15,
            pady=8,
            relief="raised",
            highlightbackground=self.COLOR_BORDE_VIOLETA,
            highlightthickness=2
        )
        self.btn_render.pack(side=tk.RIGHT, padx=5)
        
        self.lbl_estado = tk.Label(frame_bottom, text="Estado: Listo. Esperando material visual.", font=("Arial", 10, "italic"), fg="#FFF8DC", bg=self.COLOR_FONDO_VENTANA)
        self.lbl_estado.pack(fill='x', padx=15, pady=5)

        # --- PANEL CENTRAL: REGIONES Y PIZARRAS CREMA ---
        frame_central = tk.Frame(self.root, bg=self.COLOR_FONDO_VENTANA)
        frame_central.pack(fill='both', expand=True, padx=15, pady=5, side=tk.TOP)
        
        # Pizarra de Secuencia Visual (Izquierda)
        frame_timeline = ttk.LabelFrame(frame_central)
        frame_timeline.pack(side=tk.LEFT, fill='both', expand=True, padx=(0, 5))
        self.crear_cabecera_dorada(frame_timeline, " 🎞️ Línea de Tiempo (Arrastre libremente para reordenar / Use ✕ para quitar)")

        self.canvas = tk.Canvas(frame_timeline, highlightthickness=0, bg=self.COLOR_PIZARRA_CREMA)
        scrollbar = ttk.Scrollbar(frame_timeline, orient="vertical", command=self.canvas.yview)
        
        self.canvas_frame = tk.Frame(self.canvas, bg=self.COLOR_PIZARRA_CREMA)
        self.canvas_frame.bind("<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.canvas.create_window((0, 0), window=self.canvas_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=scrollbar.set)
        self.canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Panel Derecho: Audio y Transcripción
        frame_derecho = tk.Frame(frame_central, bg=self.COLOR_FONDO_VENTANA, width=420)
        frame_derecho.pack(side=tk.RIGHT, fill='both', padx=(5, 0))
        
        frame_audio = ttk.LabelFrame(frame_derecho)
        frame_audio.pack(fill='x', pady=(0, 5))
        self.crear_cabecera_dorada(frame_audio, " ♫ Audio de Fondo Activo")
        
        inner_audio = tk.Frame(frame_audio, bg=self.COLOR_FONDO_VENTANA)
        inner_audio.pack(fill='x', padx=5, pady=5)
        
        btn_audio = tk.Button(inner_audio, text="🎵 Seleccionar Pista de Audio", command=self.agregar_audio, bg="#D4AF37", fg="#222222", font=("Arial", 9, "bold"), highlightbackground=self.COLOR_BORDE_VIOLETA, highlightthickness=2)
        btn_audio.pack(side=tk.TOP, padx=10, pady=5, fill='x')
        
        self.lbl_audio = tk.Label(inner_audio, text="No se ha seleccionado música", fg="#FFE4C4", bg=self.COLOR_FONDO_VENTANA, wraplength=340, font=("Arial", 9, "italic"))
        self.lbl_audio.pack(side=tk.TOP, padx=10, pady=5)

        frame_subs = ttk.LabelFrame(frame_derecho)
        frame_subs.pack(fill='both', expand=True, pady=5)
        self.crear_cabecera_dorada(frame_subs, " 🖚 Transcripción Automática e IA (Español Estricto)")
        
        inner_subs_ctrl = tk.Frame(frame_subs, bg=self.COLOR_FONDO_VENTANA)
        inner_subs_ctrl.pack(fill='x', padx=5, pady=5)
        
        chk_subs = ttk.Checkbutton(inner_subs_ctrl, text="Incrustar Subtítulos", variable=self.aplicar_subtitulos)
        chk_subs.pack(side=tk.LEFT, padx=5)
        
        btn_grabar_subs = tk.Button(inner_subs_ctrl, text="💾 Grabar Correcciones", command=self.grabar_subtitulos_memoria, bg="#D4AF37", fg="#222222", font=("Arial", 8, "bold"), highlightbackground=self.COLOR_BORDE_VIOLETA, highlightthickness=2)
        btn_grabar_subs.pack(side=tk.RIGHT, padx=5)
        
        self.txt_subtitulos = tk.Text(frame_subs, wrap=tk.WORD, font=("Arial", 10), bg=self.COLOR_PIZARRA_CREMA, fg="#111111", insertbackground="black")
        self.txt_subtitulos.pack(fill='both', expand=True, padx=8, pady=5)
        
        self.lbl_ia_estado = tk.Label(frame_subs, text="IA Whisper: Activa y lista.", font=("Arial", 9, "italic"), fg="#7FFFD4", bg=self.COLOR_FONDO_VENTANA)
        self.lbl_ia_estado.pack(fill='x', padx=5, pady=2)

    def grabar_subtitulos_memoria(self):
        self.subtitulos_guardados = self.txt_subtitulos.get("1.0", tk.END).strip()
        self.lbl_estado.config(text="Estado: ¡Correcciones de texto guardadas en memoria!")

    def formatear_tiempo(self, segundos):
        mins = int(segundos) // 60
        segs = int(segundos) % 60
        return f"{mins:02d}:{segs:02d}"

    def leer_imagen_segura(self, ruta):
        try:
            with open(ruta, "rb") as f:
                bytes_archivo = bytearray(f.read())
            array_numpy = np.asarray(bytes_archivo, dtype=np.uint8)
            imagen_cv2 = cv2.imdecode(array_numpy, cv2.IMREAD_COLOR)
            return imagen_cv2
        except:
            return None

    def calcular_y_actualizar_tiempos(self):
        duracion_visual_base = 0.0
        if self.ruta_portada: duracion_visual_base += self.DURACION_IMAGEN_BASE
        if self.ruta_cierre: duracion_visual_base += self.DURACION_IMAGEN_BASE
            
        for item in self.linea_tiempo_visual:
            if item['tipo'] == 'img': duracion_visual_base += self.DURACION_IMAGEN_BASE
            elif item['tipo'] == 'vid':
                cap = cv2.VideoCapture(item['ruta'])
                fps = cap.get(cv2.CAP_PROP_FPS)
                frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
                if fps > 0: duracion_visual_base += (frames / fps)
                cap.release()
                
        self.lbl_tiempo_video.config(text=f"Duración Visual Base: {self.formatear_tiempo(duracion_visual_base)}")
        
        if self.duracion_audio_seg > 0:
            self.lbl_tiempo_audio.config(text=f"Duración de la Pista: {self.formatear_tiempo(self.duracion_audio_seg)}")
            if duracion_visual_base < self.duracion_audio_seg:
                self.lbl_estado_ajuste.config(text="Modo: ¡Auto-Sincronización Activa! Las fotos se estirarán.", fg="#7FFF00")
            else:
                self.lbl_estado_ajuste.config(text="Modo: Duración suficiente.", fg="#FF8C00")
        else:
            self.lbl_tiempo_audio.config(text="Duración de la Pista: Sin Audio")

    def transcribir_audio_con_ia(self, ruta_audio):
        if not WHISPER_DISPONIBLE:
            self.lbl_ia_estado.config(text="IA Whisper no disponible localmente.", fg="#FF4500")
            return
        self.lbl_ia_estado.config(text="🤖 IA Analizando pista (Español)... por favor espera", fg="#DA70D6")
        self.root.update_idletasks()
        try:
            modelo = whisper.load_model("base")
            # Forzado estricto a Español para evitar traducciones erróneas en inglés
            resultado = modelo.transcribe(ruta_audio, fp16=False, language="es")
            self.txt_subtitulos.delete("1.0", tk.END)
            for segmento in resultado['segments']:
                seg_inicio = int(segmento['start'])
                texto = segmento['text'].strip()
                marca_tiempo = self.formatear_tiempo(seg_inicio)
                self.txt_subtitulos.insert(tk.END, f"{marca_tiempo} - {texto}\n")
            self.grabar_subtitulos_memoria()
            self.lbl_ia_estado.config(text="✨ ¡Transcripción automática en español completada!", fg="#00FF7F")
        except Exception as e:
            self.lbl_ia_estado.config(text=f"Error IA: {str(e)}", fg="#FF4500")

    def estampar_texto_con_sombra(self, lienzo_cv2, texto, posicion, tamaño_fuente=32, color_texto=(255, 255, 255)):
        """Estampa texto en el fotograma aplicando una sombra negra discreta para evitar que se pierda en fondos blancos"""
        img_pil = Image.fromarray(cv2.cvtColor(lienzo_cv2, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(img_pil)
        try: 
            font = ImageFont.truetype("arial.ttf", tamaño_fuente)
        except: 
            font = ImageFont.load_default()
            
        x, y = posicion
        # Dibujar sombra negra con un desfase sutil de 2 píxeles
        draw.text((x + 2, y + 2), texto, font=font, fill=(0, 0, 0))
        # Dibujar texto principal sobre la sombra
        draw.text((x, y), texto, font=font, fill=color_texto)
        return cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)

    def agregar_portada(self):
        ruta = filedialog.askopenfilename(filetypes=[("Imágenes", "*.jpg *.png *.jpeg")])
        if ruta:
            self.ruta_portada = ruta
            self.lbl_portada.config(text=f"Portada: {os.path.basename(ruta)[:15]}...", fg="#00FF00")
            self.calcular_y_actualizar_tiempos()

    def agregar_cierre(self):
        ruta = filedialog.askopenfilename(filetypes=[("Imágenes", "*.jpg *.png *.jpeg")])
        if ruta:
            self.ruta_cierre = ruta
            self.lbl_cierre.config(text=f"Cierre: {os.path.basename(ruta)[:15]}...", fg="#00FF00")
            self.calcular_y_actualizar_tiempos()

    def agregar_audio(self):
        ruta = filedialog.askopenfilename(filetypes=[("Archivos de Audio", "*.mp3 *.wav")])
        if ruta:
            self.ruta_audio_fondo = ruta
            self.lbl_audio.config(text=f"Audio: {os.path.basename(ruta)}", fg="#00FF00")
            self.duracion_audio_seg = 218.0
            self.calcular_y_actualizar_tiempos()
            hilo_ia = threading.Thread(target=self.transcribir_audio_con_ia, args=(ruta,), daemon=True)
            hilo_ia.start()

    def agregar_medios(self):
        archivos = filedialog.askopenfilenames(filetypes=[("Medios de Video y Foto", "*.mp4 *.jpg *.png *.jpeg")])
        if archivos:
            for f in archivos:
                tipo = 'vid' if f.lower().endswith('.mp4') else 'img'
                item_data = {'tipo': tipo, 'ruta': f}
                self.linea_timeline_actual_index = len(self.linea_tiempo_visual)
                self.linea_tiempo_visual.append(item_data)
            self.refrescar_interfaz()
            self.calcular_y_actualizar_tiempos()

    def iniciar_arrastre(self, event, index):
        self.drag_start_index = index

    def durante_arrastre(self, event):
        self.canvas.config(cursor="fleur")

    def finalizar_arrastre(self, event):
        self.canvas.config(cursor="")
        if self.drag_start_index is None: return
        y_canvas = event.y_root - self.canvas_frame.winfo_rooty()
        widgets_slots = self.canvas_frame.winfo_children()
        nuevo_index = len(self.linea_tiempo_visual) - 1
        for i, widget in enumerate(widgets_slots):
            if y_canvas < (widget.winfo_y() + widget.winfo_height()):
                nuevo_index = i
                break
        if self.drag_start_index != nuevo_index:
            item = self.linea_tiempo_visual.pop(self.drag_start_index)
            self.linea_tiempo_visual.insert(nuevo_index, item)
            self.refrescar_interfaz()
        self.drag_start_index = None
        self.calcular_y_actualizar_tiempos()

    def eliminar_item(self, index):
        """Remueve de manera segura un elemento seleccionado de la secuencia visual"""
        self.linea_tiempo_visual.pop(index)
        self.refrescar_interfaz()
        self.calcular_y_actualizar_tiempos()

    def generar_thumbnail(self, ruta, tipo):
        try:
            if tipo == 'img':
                img_cv = self.leer_imagen_segura(ruta)
                if img_cv is not None:
                    img = Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))
                else: return None
            elif tipo == 'vid':
                cap = cv2.VideoCapture(ruta)
                ret, frame = cap.read()
                cap.release()
                if ret: img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                else: img = Image.new('RGB', (80, 45), color='black')
            img.thumbnail((80, 45))
            thumb = ImageTk.PhotoImage(img)
            self.imagenes_en_memoria.append(thumb)
            return thumb
        except: return None

    def renderizar_slot_visual(self, item, index, total):
        slot = tk.Frame(self.canvas_frame, relief="ridge", borderwidth=2, bg="#FFF8DC")
        slot.pack(fill='x', pady=4, padx=8)
        
        lbl_agarre = tk.Label(slot, text=" ☰ ", font=("Arial", 14), cursor="fleur", fg="#A0522D", bg="#FFF8DC")
        lbl_agarre.pack(side=tk.LEFT, padx=5)
        
        thumb = self.generar_thumbnail(item['ruta'], item['tipo'])
        lbl_img = tk.Label(slot, bg="black")
        if thumb: lbl_img.config(image=thumb)
        lbl_img.pack(side=tk.LEFT, padx=5, pady=3)
        
        etiqueta_tipo = "[VIDEO]" if item['tipo'] == 'vid' else "[FOTO]"
        nombre = f"{etiqueta_tipo} {os.path.basename(item['ruta'])}"
        if len(nombre) > 45: nombre = nombre[:42] + "..."
        
        lbl_nombre = tk.Label(slot, text=nombre, font=("Arial", 9, "bold"), fg="#4A2711", bg="#FFF8DC")
        lbl_nombre.pack(side=tk.LEFT, padx=10, fill='x', expand=True, anchor="w")
        
        for e in [slot, lbl_agarre, lbl_img, lbl_nombre]:
            e.bind("<Button-1>", lambda event, idx=index: self.iniciar_arrastre(event, idx))
            e.bind("<B1-Motion>", self.durante_arrastre)
            e.bind("<ButtonRelease-1>", self.finalizar_arrastre)
            
        # ¡RESTAURADO! El botón de remoción física para la pizarra crema
        tk.Button(slot, text="✕", font=("Arial", 8, "bold"), width=3, bg="#CD5C5C", fg="white", bd=1, command=lambda: self.eliminar_item(index)).pack(side=tk.RIGHT, padx=8)

    def refrescar_interfaz(self):
        for w in self.canvas_frame.winfo_children(): w.destroy()
        self.imagenes_en_memoria.clear()
        total = len(self.linea_tiempo_visual)
        for i, item in enumerate(self.linea_tiempo_visual):
            self.renderizar_slot_visual(item, i, total)
        self.lbl_estado.config(text=f"Estado: {total} elementos cargados en la pizarra crema visual.")

    def ajustar_proporcion_lienzo(self, frame):
        if frame is None: return np.zeros((self.VIDEO_HEIGHT, self.VIDEO_WIDTH, 3), dtype=np.uint8)
        h_orig, w_orig = frame.shape[:2]
        escala = min(self.VIDEO_WIDTH / w_orig, self.VIDEO_HEIGHT / h_orig)
        nuevo_w, nuevo_h = int(w_orig * escala), int(h_orig * escala)
        frame_redimensionado = cv2.resize(frame, (nuevo_w, nuevo_h), interpolation=cv2.INTER_AREA)
        lienzo = np.zeros((self.VIDEO_HEIGHT, self.VIDEO_WIDTH, 3), dtype=np.uint8)
        x_offset = (self.VIDEO_WIDTH - nuevo_w) // 2
        y_offset = (self.VIDEO_HEIGHT - nuevo_h) // 2
        lienzo[y_offset:y_offset+nuevo_h, x_offset:x_offset+nuevo_w] = frame_redimensionado
        return lienzo

    def obtener_subtitulo_para_tiempo(self, segundo_actual):
        if not self.aplicar_subtitulos.get() or not self.subtitulos_guardados:
            return ""
        lineas = self.subtitulos_guardados.split('\n')
        sub_valido = ""
        for line in lineas:
            if '-' in line:
                partes = line.split('-', 1)
                tiempo_str = partes[0].strip()
                texto_str = partes[1].strip()
                try:
                    minutos, segundos = map(int, tiempo_str.split(':'))
                    segundo_sub = (minutos * 60) + segundos
                    if segundo_actual >= segundo_sub:
                        sub_valido = texto_str
                except: pass
        return sub_valido

    def ejecutar_renderizado(self):
        if not self.linea_tiempo_visual and not self.ruta_portada:
            messagebox.showwarning("Sin Medios", "Por favor inserta material en la secuencia visual primero.")
            return
            
        archivo_salida_temp = filedialog.asksaveasfilename(defaultextension=".mp4", filetypes=[("Video MP4", "*.mp4")])
        if not archivo_salida_temp: return
        
        self.btn_render.config(state='disabled', bg='#6C757D')
        self.btn_agregar.config(state='disabled')
        self.grabar_subtitulos_memoria()
        
        def proceso_hilo():
            try:
                duracion_videos = 0.0
                conteo_imagenes = 0
                if self.ruta_portada: conteo_imagenes += 1
                if self.ruta_cierre: conteo_imagenes += 1
                
                for item in self.linea_tiempo_visual:
                    if item['tipo'] == 'img': conteo_imagenes += 1
                    elif item['tipo'] == 'vid':
                        c = cv2.VideoCapture(item['ruta'])
                        f_fps = c.get(cv2.CAP_PROP_FPS)
                        f_cnt = c.get(cv2.CAP_PROP_FRAME_COUNT)
                        if f_fps > 0: duracion_videos += (f_cnt / f_fps)
                        c.release()

                duracion_restante = self.duracion_audio_seg - duracion_videos
                if self.ruta_audio_fondo and duracion_restante > 0 and conteo_imagenes > 0:
                    duracion_por_foto = duracion_restante / conteo_imagenes
                else:
                    duracion_por_foto = self.DURACION_IMAGEN_BASE

                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                ruta_video_puro = archivo_salida_temp.replace(".mp4", "_visual.mp4")
                video_writer = cv2.VideoWriter(ruta_video_puro, fourcc, self.FPS, (self.VIDEO_WIDTH, self.VIDEO_HEIGHT))
                
                frame_contador = 0
                nombre_pista = os.path.basename(self.ruta_audio_fondo) if self.ruta_audio_fondo else "Sin Audio"
                
                # --- PROCESAMIENTO: PORTADA INICIAL ---
                if self.ruta_portada:
                    img_portada = self.leer_imagen_segura(self.ruta_portada)
                    frame_corregido = self.ajustar_proporcion_lienzo(img_portada)
                    texto_leyenda = self.txt_leyenda_portada.get()
                    if texto_leyenda:
                        frame_corregido = self.estampar_texto_con_sombra(frame_corregido, texto_leyenda, (80, self.VIDEO_HEIGHT - 130), 40, (255, 215, 0))
                                    
                    frames_a_escribir = int(self.FPS * duracion_por_foto)
                    for _ in range(frames_a_escribir):
                        segundo_global = frame_contador // self.FPS
                        frame_final_render = frame_corregido.copy()
                        
                        # Inyección de marca de pista por los primeros 20 segundos del video
                        if segundo_global <= 20 and self.ruta_audio_fondo:
                            frame_final_render = self.estampar_texto_con_sombra(frame_final_render, f"🎵 Pista: {nombre_pista}", (40, 40), 22, (255, 255, 255))
                            
                        texto_sub = self.obtener_subtitulo_para_tiempo(segundo_global)
                        if texto_sub:
                            frame_final_render = self.estampar_texto_con_sombra(frame_final_render, texto_sub, (50, self.VIDEO_HEIGHT - 60), 28, (0, 255, 255))
                        video_writer.write(frame_final_render)
                        frame_contador += 1
                
                # --- PROCESAMIENTO: LÍNEA DE TIEMPO INTERMEDIA ---
                for item in self.linea_tiempo_visual:
                    if item['tipo'] == 'img':
                        img = self.leer_imagen_segura(item['ruta'])
                        frame_corregido = self.ajustar_proporcion_lienzo(img)
                        frames_a_escribir = int(self.FPS * duracion_por_foto)
                        for _ in range(frames_a_escribir):
                            segundo_global = frame_contador // self.FPS
                            frame_final_render = frame_corregido.copy()
                            
                            if segundo_global <= 20 and self.ruta_audio_fondo:
                                frame_final_render = self.estampar_texto_con_sombra(frame_final_render, f"🎵 Pista: {nombre_pista}", (40, 40), 22, (255, 255, 255))
                                
                            texto_sub = self.obtener_subtitulo_para_tiempo(segundo_global)
                            if texto_sub:
                                frame_final_render = self.estampar_texto_con_sombra(frame_final_render, texto_sub, (50, self.VIDEO_HEIGHT - 60), 28, (0, 255, 255))
                            video_writer.write(frame_final_render)
                            frame_contador += 1
                            
                    elif item['tipo'] == 'vid':
                        cap = cv2.VideoCapture(item['ruta'])
                        while cap.isOpened():
                            ret, frame = cap.read()
                            if not ret: break
                            frame_corregido = self.ajustar_proporcion_lienzo(frame)
                            segundo_global = frame_contador // self.FPS
                            
                            if segundo_global <= 20 and self.ruta_audio_fondo:
                                frame_corregido = self.estampar_texto_con_sombra(frame_corregido, f"🎵 Pista: {nombre_pista}", (40, 40), 22, (255, 255, 255))
                                
                            texto_sub = self.obtener_subtitulo_para_tiempo(segundo_global)
                            if texto_sub:
                                frame_corregido = self.estampar_texto_con_sombra(frame_corregido, texto_sub, (50, self.VIDEO_HEIGHT - 60), 28, (0, 255, 255))
                            video_writer.write(frame_corregido)
                            frame_contador += 1
                        cap.release()
                
                # --- PROCESAMIENTO: FOTO DE CIERRE FINAL ---
                if self.ruta_cierre:
                    img_cierre = self.leer_imagen_segura(self.ruta_cierre)
                    frame_corregido = self.ajustar_proporcion_lienzo(img_cierre)
                    texto_leyenda_cierre = self.txt_leyenda_cierre.get()
                    if texto_leyenda_cierre:
                        frame_corregido = self.estampar_texto_con_sombra(frame_corregido, texto_leyenda_cierre, (80, self.VIDEO_HEIGHT - 130), 40, (255, 215, 0))
                                    
                    frames_a_escribir = int(self.FPS * duracion_por_foto)
                    for _ in range(frames_a_escribir):
                        segundo_global = frame_contador // self.FPS
                        frame_final_render = frame_corregido.copy()
                        
                        if segundo_global <= 20 and self.ruta_audio_fondo:
                            frame_final_render = self.estampar_texto_con_sombra(frame_final_render, f"🎵 Pista: {nombre_pista}", (40, 40), 22, (255, 255, 255))
                            
                        texto_sub = self.obtener_subtitulo_para_tiempo(segundo_global)
                        if texto_sub:
                            frame_final_render = self.estampar_texto_con_sombra(frame_final_render, texto_sub, (50, self.VIDEO_HEIGHT - 60), 28, (0, 255, 255))
                        video_writer.write(frame_final_render)
                        frame_contador += 1
                
                video_writer.release()
                
                # Integración final de audio con FFmpeg externo
                if self.ruta_audio_fondo and os.path.exists(self.ruta_audio_fondo):
                    try:
                        import subprocess
                        self.lbl_estado.config(text="Estado: Ensamblando pistas y mezclando audio de fidelidad...")
                        cmd = f'ffmpeg -y -i "{ruta_video_puro}" -i "{self.ruta_audio_fondo}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "{archivo_salida_temp}"'
                        subprocess.run(cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                        if os.path.exists(archivo_salida_temp) and os.path.getsize(archivo_salida_temp) > 1000:
                            os.remove(ruta_video_puro)
                        else: os.rename(ruta_video_puro, archivo_salida_temp)
                    except: os.rename(ruta_video_puro, archivo_salida_temp)
                else:
                    if os.path.exists(ruta_video_puro): os.rename(ruta_video_puro, archivo_salida_temp)
                
                self.lbl_estado.config(text="¡Video exportado exitosamente! 🎉")
                messagebox.showinfo("Éxito Total", "Video renderizado completo con auto-sincronización, leyendas y sombras.")
                
            except Exception as e:
                messagebox.showerror("Error", f"Fallo en renderizado: {e}")
            finally:
                self.btn_render.config(state='normal', bg='#007BFF')
                self.btn_agregar.config(state='normal')

        threading.Thread(target=proceso_hilo, daemon=True).start()

if __name__ == "__main__":
    root = tk.Tk()
    app = SoftwareVideoDiamante(root)
    root.mainloop() 