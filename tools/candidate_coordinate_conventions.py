from __future__ import annotations


EXPLORER_MAP_WIDTH = 9216
EXPLORER_MAP_HEIGHT = 7168


def explorer_visual_to_leaflet_coordinates(
    visual_x: float,
    visual_y: float,
    explorer_map_height: float = EXPLORER_MAP_HEIGHT,
) -> tuple[float, float]:
    """Convert Explorer base-map visual pixels into Leaflet/app coordinates.

    Image registration operates only in top-left visual image coordinates.
    The Leaflet/app Y inversion happens exactly once, after registration has
    produced an Explorer visual coordinate.
    """

    return float(visual_x), float(explorer_map_height) - float(visual_y)


def leaflet_to_explorer_visual_coordinates(
    leaflet_x: float,
    leaflet_y: float,
    explorer_map_height: float = EXPLORER_MAP_HEIGHT,
) -> tuple[float, float]:
    """Convert Leaflet/app coordinates back into Explorer visual pixels."""

    return float(leaflet_x), float(explorer_map_height) - float(leaflet_y)


def visual_image_y_to_explorer_y(
    visual_y: float,
    explorer_map_height: float = EXPLORER_MAP_HEIGHT,
) -> float:
    """Deprecated compatibility wrapper for older audit tools.

    Prefer explorer_visual_to_leaflet_coordinates() so the code makes it clear
    that registration has already produced Explorer visual coordinates.
    """

    return float(explorer_map_height) - float(visual_y)


def explorer_y_to_visual_image_y(
    explorer_y: float,
    explorer_map_height: float = EXPLORER_MAP_HEIGHT,
) -> float:
    """Deprecated compatibility wrapper for older audit drawing code."""

    return float(explorer_map_height) - float(explorer_y)
