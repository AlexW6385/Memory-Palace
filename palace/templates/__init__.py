"""Architecture templates: each turns a KnowledgeSystem into geometry inside one plot."""
from palace.templates import avenue, city, radial, spiral, terraces

TEMPLATES = {
    "spiral": spiral.layout,
    "city": city.layout,
    "terraces": terraces.layout,
    "avenue": avenue.layout,
    "radial": radial.layout,
}
