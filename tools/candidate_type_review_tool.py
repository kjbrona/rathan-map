from __future__ import annotations

import json
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import ttk

from PIL import Image, ImageTk


ROOT = Path(__file__).resolve().parents[1]
PREVIEW_DIR = ROOT / "candidate-survey" / "registration-v2-preview"
REVIEW_DIR = PREVIEW_DIR / "type-review"
QUEUE_PATH = REVIEW_DIR / "candidate-type-review-queue.json"
OPTIONS_PATH = REVIEW_DIR / "herb-type-options.json"
DECISIONS_PATH = PREVIEW_DIR / "type-review-decisions.json"

DECISIONS = {
    "Confirm Candidate Type": "confirm-candidate-type",
    "Change Candidate Type": "change-candidate-type",
    "Existing Marker Type Appears Wrong": "existing-marker-type-appears-wrong",
    "Mixed Herb Cluster": "mixed-herb-cluster",
    "Candidate Classification Uncertain": "candidate-classification-uncertain",
    "Reject Candidate": "reject-candidate",
    "Skip": "skip",
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


class ImagePanel(ttk.LabelFrame):
    def __init__(self, parent, title: str):
        super().__init__(parent, text=title)
        self.label = ttk.Label(self)
        self.label.pack(fill=tk.BOTH, expand=True)
        self.tk_image = None

    def show(self, path: str, max_size: tuple[int, int]) -> None:
        if not path:
            self.label.configure(image="", text="No image available")
            self.tk_image = None
            return
        image_path = ROOT / path
        if not image_path.exists():
            self.label.configure(image="", text=f"Missing image: {path}")
            self.tk_image = None
            return
        image = Image.open(image_path).convert("RGB")
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        self.tk_image = ImageTk.PhotoImage(image)
        self.label.configure(image=self.tk_image, text="")


class CandidateTypeReviewTool:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("Candidate Herb Type Review")
        self.queue = read_json(QUEUE_PATH)
        self.herb_options = read_json(OPTIONS_PATH)
        self.decisions = read_json(DECISIONS_PATH) if DECISIONS_PATH.exists() else []
        self.decision_by_id = {item["candidateId"]: item for item in self.decisions}
        self.index = 0
        self.active_queue = []

        self.status = tk.StringVar()
        self.progress = tk.StringVar()
        self.info = tk.StringVar()
        self.nearby = tk.StringVar()
        self.priority = tk.StringVar()
        self.decision = tk.StringVar(value="Skip")
        self.reviewed_type = tk.StringVar()
        self.notes = tk.Text(self.root, height=4, wrap=tk.WORD)

        top = ttk.Frame(self.root)
        top.pack(fill=tk.X, padx=8, pady=6)
        ttk.Button(top, text="Previous", command=self.previous_item).pack(side=tk.LEFT)
        ttk.Button(top, text="Next", command=self.next_item).pack(side=tk.LEFT, padx=4)
        ttk.Label(top, textvariable=self.status).pack(side=tk.LEFT, padx=12)
        ttk.Button(top, text="Save Decision", command=self.save_current).pack(side=tk.RIGHT)

        body = ttk.Frame(self.root)
        body.pack(fill=tk.BOTH, expand=True, padx=8, pady=6)

        left = ttk.Frame(body)
        left.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 8))
        ttk.Label(left, textvariable=self.progress, justify=tk.LEFT, wraplength=420).pack(fill=tk.X)
        ttk.Label(left, textvariable=self.priority, justify=tk.LEFT, wraplength=420).pack(fill=tk.X, pady=(4, 8))
        ttk.Label(left, textvariable=self.info, justify=tk.LEFT, wraplength=420).pack(fill=tk.X)
        ttk.Label(left, text="Nearby existing Herb markers within 200 units:").pack(anchor=tk.W, pady=(8, 0))
        ttk.Label(left, textvariable=self.nearby, justify=tk.LEFT, wraplength=420).pack(fill=tk.X)
        ttk.Label(left, text="Review action:").pack(anchor=tk.W, pady=(8, 0))
        ttk.OptionMenu(left, self.decision, self.decision.get(), *DECISIONS).pack(fill=tk.X)
        ttk.Label(left, text="Reviewed candidate type:").pack(anchor=tk.W, pady=(8, 0))
        self.type_menu = ttk.OptionMenu(left, self.reviewed_type, "")
        self.type_menu.pack(fill=tk.X)
        ttk.Label(left, text="Notes:").pack(anchor=tk.W, pady=(8, 0))
        self.notes.pack(fill=tk.X)

        images = ttk.Frame(body)
        images.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.map_panel = ImagePanel(images, "Explorer map crop")
        self.map_panel.pack(side=tk.TOP, fill=tk.BOTH, expand=True, pady=(0, 6))
        self.source_panel = ImagePanel(images, "Source detection crop")
        self.source_panel.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

        self.populate_type_menu()
        self.rebuild_active_queue()
        self.root.bind("<Key>", self.handle_shortcut)
        self.load_item()

    def populate_type_menu(self) -> None:
        menu = self.type_menu["menu"]
        menu.delete(0, "end")
        for item in self.herb_options:
            label = f"{item['name']} ({item['id']})"
            menu.add_command(
                label=label,
                command=lambda value=item["id"]: self.reviewed_type.set(value),
            )

    def current_item(self) -> dict:
        return self.active_queue[self.index]

    def is_reviewed(self, candidate_id: str) -> bool:
        return bool(self.decision_by_id.get(candidate_id, {}).get("reviewed"))

    def item_priority(self, item: dict) -> tuple[int, str]:
        audit = item["audit"]
        candidate = item["candidate"]
        if audit.get("anyTypeWithin150NoSameTypeWithin300"):
            return 1, "Priority 1: Any herb within 150, no same-type within 300"
        if audit.get("nearbyDifferentHerb"):
            return 2, "Priority 2: Nearby Different Herb"
        if candidate.get("surveyConfidence") == "low":
            return 3, "Priority 3: Low-confidence classification"
        return 4, "Priority 4: Remaining unresolved type mismatch"

    def rebuild_active_queue(self) -> None:
        self.active_queue = [
            item
            for item in self.queue
            if not self.is_reviewed(item["candidateId"])
        ]
        self.active_queue.sort(
            key=lambda item: (
                self.item_priority(item)[0],
                item["candidateId"],
            )
        )
        if self.index >= len(self.active_queue):
            self.index = max(0, len(self.active_queue) - 1)

    def decision_counts(self) -> dict[str, int]:
        counts = {
            "confirmed": 0,
            "typeChanges": 0,
            "existingMarkerFlags": 0,
            "mixedClusters": 0,
            "uncertain": 0,
            "rejected": 0,
        }
        for decision in self.decision_by_id.values():
            if not decision.get("reviewed"):
                continue
            value = decision.get("reviewDecision")
            if value == "confirm-candidate-type":
                counts["confirmed"] += 1
            elif value == "change-candidate-type":
                counts["typeChanges"] += 1
            elif value == "existing-marker-type-appears-wrong":
                counts["existingMarkerFlags"] += 1
            elif value == "mixed-herb-cluster":
                counts["mixedClusters"] += 1
            elif value == "candidate-classification-uncertain":
                counts["uncertain"] += 1
            elif value == "reject-candidate":
                counts["rejected"] += 1
        return counts

    def update_progress(self) -> None:
        reviewed = sum(
            1
            for item in self.queue
            if self.is_reviewed(item["candidateId"])
        )
        remaining = len(self.queue) - reviewed
        counts = self.decision_counts()
        self.progress.set(
            "\n".join(
                [
                    f"Total queued: {len(self.queue)}",
                    f"Reviewed: {reviewed}",
                    f"Remaining: {remaining}",
                    f"Confirmed: {counts['confirmed']} | Type changes: {counts['typeChanges']}",
                    f"Mixed: {counts['mixedClusters']} | Uncertain: {counts['uncertain']} | Rejected: {counts['rejected']}",
                ]
            )
        )

    def load_item(self) -> None:
        self.update_progress()
        if not self.active_queue:
            self.status.set("Review complete")
            self.priority.set("No unreviewed candidates remain.")
            self.info.set("All queued candidates have reviewed decisions.")
            self.nearby.set("")
            self.map_panel.show("", (840, 520))
            self.source_panel.show("", (840, 360))
            return
        item = self.current_item()
        candidate = item["candidate"]
        audit = item["audit"]
        saved = self.decision_by_id.get(candidate["candidateId"], {})
        _, priority_label = self.item_priority(item)
        self.priority.set(f"Current priority group: {priority_label}")
        self.status.set(f"{self.index + 1} of {len(self.active_queue)} remaining | {candidate['candidateId']}")
        self.info.set(
            "\n".join(
                [
                    f"Candidate: {candidate['candidateId']}",
                    f"Candidate type: {candidate.get('typeName')} ({candidate.get('type')})",
                    f"Survey confidence: {candidate.get('surveyConfidence')}",
                    f"Explorer X/Y: {candidate.get('x'):.2f}, {candidate.get('y'):.2f}",
                    f"Nearest same type: {audit.get('nearestSameTypeName') or 'None'} "
                    f"{audit.get('nearestSameTypeDistance')}",
                    f"Nearest any type: {audit.get('nearestAnyTypeName')} ({audit.get('nearestAnyTypeType')}) "
                    f"{audit.get('nearestAnyTypeDistance')}",
                    f"Nearest marker status/confidence: {audit.get('nearestAnyTypeStatus')} / {audit.get('nearestAnyTypeConfidence')}",
                    f"Digit/classification evidence: source crop shows detected pin, nearby number, anchor, and assigned type.",
                ]
            )
        )
        self.nearby.set(
            "\n".join(
                f"- {marker['name']} ({marker['type']}) {marker['distance']:.1f} | {marker['status']} / {marker['confidence']}"
                for marker in item["nearbyMarkersWithin200"]
            )
            or "None"
        )
        reverse_decisions = {value: key for key, value in DECISIONS.items()}
        self.decision.set(reverse_decisions.get(saved.get("reviewDecision", "skip"), "Skip"))
        self.reviewed_type.set(saved.get("reviewedType") or candidate.get("type"))
        self.notes.delete("1.0", tk.END)
        self.notes.insert("1.0", saved.get("notes", ""))
        self.map_panel.show(item.get("mapCrop", ""), (840, 520))
        self.source_panel.show(item.get("sourceCrop", ""), (840, 360))

    def save_current(self) -> None:
        if not self.active_queue:
            return
        item = self.current_item()
        candidate = item["candidate"]
        decision = {
            "candidateId": candidate["candidateId"],
            "originalType": candidate["type"],
            "reviewDecision": DECISIONS[self.decision.get()],
            "reviewedType": self.reviewed_type.get() or candidate["type"],
            "notes": self.notes.get("1.0", tk.END).strip(),
            "reviewedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
            "reviewed": DECISIONS[self.decision.get()] != "skip",
        }
        self.decision_by_id[candidate["candidateId"]] = decision
        self.decisions = list(self.decision_by_id.values())
        write_json(DECISIONS_PATH, self.decisions)
        self.status.set(f"Saved {candidate['candidateId']}")
        self.rebuild_active_queue()
        self.load_item()

    def next_item(self) -> None:
        if self.index < len(self.active_queue) - 1:
            self.index += 1
            self.load_item()

    def previous_item(self) -> None:
        if self.index > 0:
            self.index -= 1
            self.load_item()

    def handle_shortcut(self, event) -> None:
        focus = self.root.focus_get()
        focus_class = focus.winfo_class() if focus else ""
        if isinstance(focus, (tk.Entry, tk.Text, ttk.Combobox)) or focus_class in {
            "TMenubutton",
            "Menubutton",
            "Listbox",
        }:
            return
        key = event.char.lower()
        shortcut = {
            "c": "Confirm Candidate Type",
            "t": "Change Candidate Type",
            "m": "Mixed Herb Cluster",
            "u": "Candidate Classification Uncertain",
            "r": "Reject Candidate",
            "s": "Skip",
        }.get(key)
        if shortcut:
            self.decision.set(shortcut)
            if shortcut != "Change Candidate Type":
                self.save_current()

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    CandidateTypeReviewTool().run()
