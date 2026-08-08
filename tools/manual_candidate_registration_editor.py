from __future__ import annotations

import json
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk

from PIL import Image, ImageTk


ROOT = Path(__file__).resolve().parents[1]
REGISTRATION_PATH = ROOT / "data" / "candidate-survey" / "source-map-registration.json"
EXPLORER_IMAGE_PATH = ROOT / "images" / "rdr2-map.jpg"

LANDMARKS = [
    "Tumbleweed road intersection",
    "Armadillo main road intersection",
    "MacFarlane's Ranch rail/road crossing",
    "Thieves Landing bridge or road junction",
    "Blackwater central road intersection",
    "Strawberry central bridge",
    "Owanjila dam or shoreline point",
    "Wallace Station rail intersection",
    "Valentine main road/rail crossing",
    "Flatneck Station rail junction",
    "Emerald Ranch rail/road crossing",
    "Rhodes main intersection",
    "Braithwaite Manor entrance-road junction",
    "Saint Denis northern bridge",
    "Saint Denis western bridge",
    "Van Horn central road",
    "Annesburg rail/road point",
    "Northeast coastline point",
    "Southwest San Luis River bend",
    "Flat Iron Lake shoreline point",
    "Kamassa River junction",
    "Dakota River bend",
]


class ZoomImage:
    def __init__(self, parent: tk.Widget, title: str, click_callback):
        frame = ttk.LabelFrame(parent, text=title)
        frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=4, pady=4)
        self.canvas = tk.Canvas(frame, bg="#1c1712", width=640, height=520)
        self.canvas.pack(fill=tk.BOTH, expand=True)
        self.canvas.bind("<Button-1>", self.on_click)
        self.canvas.bind("<MouseWheel>", self.on_mousewheel)
        self.canvas.bind("<ButtonPress-2>", self.start_pan)
        self.canvas.bind("<B2-Motion>", self.pan)
        self.click_callback = click_callback
        self.image: Image.Image | None = None
        self.tk_image = None
        self.zoom = 0.32
        self.offset_x = 0.0
        self.offset_y = 0.0
        self.points: dict[str, tuple[float, float]] = {}
        self.bounds: dict | None = None
        self.title = title
        self.pan_start: tuple[int, int] | None = None

    def load(self, path: str | Path) -> None:
        self.image = Image.open(path).convert("RGB")
        self.zoom = min(0.7, 620 / self.image.width)
        self.offset_x = 0
        self.offset_y = 0
        self.redraw()

    def screen_to_image(self, screen_x: float, screen_y: float) -> tuple[float, float]:
        return (
            (screen_x - self.offset_x) / self.zoom,
            (screen_y - self.offset_y) / self.zoom,
        )

    def image_to_screen(self, image_x: float, image_y: float) -> tuple[float, float]:
        return (
            image_x * self.zoom + self.offset_x,
            image_y * self.zoom + self.offset_y,
        )

    def on_click(self, event) -> None:
        if not self.image:
            return
        x, y = self.screen_to_image(event.x, event.y)
        if x < 0 or y < 0 or x > self.image.width or y > self.image.height:
            return
        self.click_callback(self, x, y)

    def on_mousewheel(self, event) -> None:
        if not self.image:
            return
        old_zoom = self.zoom
        factor = 1.12 if event.delta > 0 else 1 / 1.12
        self.zoom = max(0.08, min(4.0, self.zoom * factor))
        image_x, image_y = self.screen_to_image(event.x, event.y)
        self.offset_x = event.x - image_x * self.zoom
        self.offset_y = event.y - image_y * self.zoom
        if old_zoom != self.zoom:
            self.redraw()

    def start_pan(self, event) -> None:
        self.pan_start = (event.x, event.y)

    def pan(self, event) -> None:
        if not self.pan_start:
            return
        last_x, last_y = self.pan_start
        self.offset_x += event.x - last_x
        self.offset_y += event.y - last_y
        self.pan_start = (event.x, event.y)
        self.redraw()

    def redraw(self) -> None:
        self.canvas.delete("all")
        if not self.image:
            return
        width = max(1, int(self.image.width * self.zoom))
        height = max(1, int(self.image.height * self.zoom))
        resized = self.image.resize((width, height), Image.Resampling.LANCZOS)
        self.tk_image = ImageTk.PhotoImage(resized)
        self.canvas.create_image(self.offset_x, self.offset_y, image=self.tk_image, anchor=tk.NW)
        for name, (x, y) in self.points.items():
            sx, sy = self.image_to_screen(x, y)
            self.canvas.create_line(sx - 8, sy, sx + 8, sy, fill="#ff2f2f", width=2)
            self.canvas.create_line(sx, sy - 8, sx, sy + 8, fill="#ff2f2f", width=2)
            self.canvas.create_text(sx + 8, sy - 8, text=name, fill="#ffffff", anchor=tk.SW)
        if self.bounds:
            left, top = self.image_to_screen(self.bounds["left"], self.bounds["top"])
            right, bottom = self.image_to_screen(self.bounds["right"], self.bounds["bottom"])
            self.canvas.create_rectangle(left, top, right, bottom, outline="#2dd36f", width=3)
            self.canvas.create_text(left + 8, top + 8, text="Geographic content bounds", fill="#2dd36f", anchor=tk.NW)


class RegistrationEditor:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("Candidate Survey Manual Registration Editor")
        self.registration = json.loads(REGISTRATION_PATH.read_text(encoding="utf-8"))
        self.map_ids = list(self.registration["maps"])
        self.current_map_id = tk.StringVar(value=self.map_ids[0])
        self.current_landmark = tk.StringVar(value=LANDMARKS[0])
        self.status = tk.StringVar(value="Pick a landmark, then click it on both images.")
        self.pending_bounds_corner: str | None = None

        top = ttk.Frame(self.root)
        top.pack(fill=tk.X, padx=6, pady=4)
        ttk.Label(top, text="Source map").pack(side=tk.LEFT)
        map_menu = ttk.OptionMenu(top, self.current_map_id, self.map_ids[0], *self.map_ids, command=lambda _: self.load_map())
        map_menu.pack(side=tk.LEFT, padx=4)
        ttk.Label(top, text="Landmark").pack(side=tk.LEFT, padx=(12, 0))
        ttk.OptionMenu(top, self.current_landmark, LANDMARKS[0], *LANDMARKS).pack(side=tk.LEFT, padx=4)
        ttk.Button(top, text="Delete selected landmark", command=self.delete_landmark).pack(side=tk.LEFT, padx=4)
        ttk.Button(top, text="Set bounds top-left", command=lambda: self.start_bounds("top-left")).pack(side=tk.LEFT, padx=4)
        ttk.Button(top, text="Set bounds bottom-right", command=lambda: self.start_bounds("bottom-right")).pack(side=tk.LEFT, padx=4)
        ttk.Button(top, text="Save registration JSON", command=self.save).pack(side=tk.RIGHT, padx=4)

        image_row = ttk.Frame(self.root)
        image_row.pack(fill=tk.BOTH, expand=True)
        self.source_view = ZoomImage(image_row, "RDO source image", self.record_source)
        self.explorer_view = ZoomImage(image_row, "Explorer base map", self.record_explorer)

        bottom = ttk.Frame(self.root)
        bottom.pack(fill=tk.X, padx=6, pady=4)
        ttk.Label(bottom, textvariable=self.status).pack(side=tk.LEFT)
        ttk.Label(
            bottom,
            text="Mouse wheel zooms. Middle-drag pans. Stored coordinates are original image pixels.",
        ).pack(side=tk.RIGHT)
        self.load_map()

    def active_config(self) -> dict:
        return self.registration["maps"][self.current_map_id.get()]

    def load_map(self) -> None:
        config = self.active_config()
        self.source_view.load(config["sourceImage"])
        self.explorer_view.load(EXPLORER_IMAGE_PATH)
        self.refresh_points()

    def refresh_points(self) -> None:
        source_points = {}
        explorer_points = {}
        for point in self.active_config().get("controlPoints", []):
            if point.get("retired"):
                continue
            if "sourceVisual" in point:
                source_points[point["name"]] = (
                    float(point["sourceVisual"]["x"]),
                    float(point["sourceVisual"]["y"]),
                )
            if "explorerVisual" in point:
                explorer_points[point["name"]] = (
                    float(point["explorerVisual"]["x"]),
                    float(point["explorerVisual"]["y"]),
                )
        self.source_view.points = source_points
        self.explorer_view.points = explorer_points
        self.source_view.bounds = self.active_config().get("geographicBoundsVisual")
        self.source_view.redraw()
        self.explorer_view.redraw()

    def start_bounds(self, corner: str) -> None:
        self.pending_bounds_corner = corner
        self.status.set(f"Click the source image to set geographic bounds {corner}.")

    def find_or_create_point(self) -> dict:
        name = self.current_landmark.get()
        points = self.active_config().setdefault("controlPoints", [])
        for point in points:
            if point.get("name") == name and not point.get("retired"):
                return point
        point = {
            "name": name,
            "sourceVisual": {},
            "explorerVisual": {},
            "selection": "independent-manual",
            "sourceCoordinateMethod": "manual-click",
            "explorerCoordinateMethod": "manual-click",
        }
        points.append(point)
        return point

    def record_source(self, _view: ZoomImage, x: float, y: float) -> None:
        if self.pending_bounds_corner:
            bounds = self.active_config().setdefault(
                "geographicBoundsVisual",
                {"left": 0, "top": 0, "right": 0, "bottom": 0},
            )
            if self.pending_bounds_corner == "top-left":
                bounds["left"] = round(x, 3)
                bounds["top"] = round(y, 3)
            else:
                bounds["right"] = round(x, 3)
                bounds["bottom"] = round(y, 3)
            self.status.set(f"Set geographic bounds {self.pending_bounds_corner}: {x:.1f}, {y:.1f}")
            self.pending_bounds_corner = None
            self.refresh_points()
            return

        point = self.find_or_create_point()
        point["sourceVisual"] = {"x": round(x, 3), "y": round(y, 3)}
        self.status.set(f"Source point set for {point['name']}: {x:.1f}, {y:.1f}")
        self.refresh_points()

    def record_explorer(self, _view: ZoomImage, x: float, y: float) -> None:
        point = self.find_or_create_point()
        point["explorerVisual"] = {"x": round(x, 3), "y": round(y, 3)}
        self.status.set(f"Explorer point set for {point['name']}: {x:.1f}, {y:.1f}")
        self.refresh_points()

    def delete_landmark(self) -> None:
        name = self.current_landmark.get()
        points = self.active_config().get("controlPoints", [])
        self.active_config()["controlPoints"] = [
            point for point in points if point.get("name") != name
        ]
        self.status.set(f"Deleted {name} from {self.current_map_id.get()}.")
        self.refresh_points()

    def save(self) -> None:
        self.registration["metadata"]["coordinateConventions"] = {
            "sourceVisual": "Top-left visual image coordinates from the RDO reference image; Y increases downward.",
            "explorerVisual": "Top-left visual image coordinates from images/rdr2-map.jpg; Y increases downward.",
            "leafletConversion": "Convert transformed Explorer visual coordinates with explorerVisualToLeafletCoordinates(x, visualY).",
        }
        self.registration["metadata"]["registrationStatus"] = "manual-control-points-in-progress"
        REGISTRATION_PATH.write_text(json.dumps(self.registration, indent=2), encoding="utf-8")
        messagebox.showinfo("Saved", f"Saved manual registration data to:\n{REGISTRATION_PATH}")

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    RegistrationEditor().run()
