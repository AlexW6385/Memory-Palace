"""The Temple of Horus, after the temple at Edfu (237–57 BC), the best preserved temple of ancient Egypt.

Its plan is the plan of every great Egyptian temple, and the route through it is
the route of the daily ritual: from the river, along an avenue of sphinxes, through
the pylon gate into an open court, then through ever darker, lower and narrower
halls, each a step higher than the last, to the sanctuary where the god lived.
Around the sanctuary runs a corridor of chapels; around the whole temple, a
passage inside the enclosure wall.

Plan (z grows from the river toward the sanctuary; x across; metres; ~0.75 of Edfu):

    z −130…−112  harbour basin          z −24…16   court of offerings (colonnade on 3 sides)
    z −112…−104  quay                   z  16…35   pronaos (first hypostyle hall, 18 columns)
    z −104…−40   avenue of ram sphinxes z  35…48   hall of appearances (12 columns) + 4 side rooms
                 (barque kiosk midway)  z  48…56   offering hall + 2 stairs to the roof
    z  −40…−33   forecourt: obelisks,   z  57…64   hall of the Ennead + chapel of Min, linen room
                 colossi, flagpoles     z  64…77   sanctuary (naos and sacred barque)
    z  −33…−24   pylon                  z  64…86   corridor of mysteries with 9 chapels
                                        x ±21…26   ambulatory inside the enclosure wall
    x 34…68      sacred lake, scarab and nilometer, through the east gate
"""
from __future__ import annotations

import math
import random

from palace.scene import Scene
from palace.site import Site

PI = math.pi
E, W, N, S = PI / 2, -PI / 2, 0.0, PI          # yaw of something facing +x, −x, +z, −z

STONE = "#d4b385"        # Nubian sandstone
STONE_IN = "#cdb08a"
FLOOR = ("#cfb48b", "#bc9f77")
FLOOR_IN = ("#c6aa82", "#b2956d")

# floor levels: each hall a step above the last
F_OUT, F_COURT, F_PRO, F_HYP, F_OFF, F_ENN, F_SAN = 0.0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8


def build(scene: Scene) -> Site:
    s = Site(scene, "edfu", {"en": "Temple of Horus", "zh": "荷鲁斯神庙"},
             {"en": "After Edfu, Ptolemaic Egypt, 237–57 BC", "zh": "仿埃德富神庙 · 托勒密埃及 · 前237—前57年"},
             "#b5852f")
    s.entrance = (0.0, F_COURT, -108.0)
    _approach(s)
    _pylon(s)
    _court(s)
    _pronaos(s)
    _hypostyle(s)
    _offering_hall(s)
    _ennead(s)
    _sanctuary(s)
    _ambulatory(s)
    _lake(s)
    _palms(s)
    return s


# ── the river approach ───────────────────────────────────────────────────────

def _approach(s: Site) -> None:
    # harbour basin cut into the bank, with a broad stair down to the water
    s.hole(-22, -130, 22, -112)
    s.piece("harbour", 0, F_OUT, -121, 0.0, w=44, d=18, depth=2.8, water=1.9, c=STONE)
    s.floor(-24, -112, 24, -104, F_COURT, cols=FLOOR)
    s.piece("quay_edge", 0, F_COURT, -112, 0.0, w=48)

    s.wing("approach", "The Approach", "前导", (0, F_COURT, -90))
    s.room("quay", "Quay and Avenue", "码头与大道", (0, F_COURT, -108), S,
           ("The god's barque landed here; the avenue led processions to the temple.",
            "神的圣船在这里靠岸，游行队伍沿大道走向神庙。"))
    s.piece("barge", 0, -1.9, -121.5, E, collide=("rect", 3.6, 21, 4))
    s.locus("The god's barge, moored at the quay", "停在码头的神之圣船", (0, -0.5, -121.5), (0, F_COURT, -109))
    s.piece("flood_stela", -12.5, F_COURT, -106.5, E, collide=("rect", 1.6, 0.9, 3.6))
    s.locus("Flood stela recording the Nile's height", "记录尼罗河水位的洪水碑", (-12.5, 1.8, -106.5),
            (-8.6, F_COURT, -106.5))

    # avenue of ram-headed sphinxes
    s.floor(-6, -104, 6, -40, F_COURT, cols=FLOOR)
    for z in (-101, -94.5, -88, -58, -51.5):
        for side, yaw in ((-1, E), (1, W)):
            s.piece("sphinx", side * 8.8, F_OUT, z, yaw, collide=("rect", 2.4, 5.2, 4))

    # barque kiosk: a way station where the procession set the barque down
    s.floor(-7, -79, 7, -65, 0.5, cols=FLOOR)
    for z in (-77, -72, -67):
        for x in (-5.4, 5.4):
            s.column(x, z, 0.5, 8.6, 0.7, "open")
    for x in (-5.4, 5.4):
        for za, zb in ((-76.3, -72.7), (-71.3, -67.7)):
            s.block(x - 0.3, za, x + 0.3, zb, 0, 3.6, cor=True, tex="relief")
        s.beam(x, -77.8, x, -66.2, 9.1, w=1.2, h=1.0)
    for z in (-77, -72, -67):
        s.beam(-6.1, z, 6.1, z, 9.1, w=1.0, h=0.8)
    s.piece("bark_stand", 0, 0.5, -72, S, collide=("rect", 2.3, 4.1, 2.5))
    s.locus("Barque stand in the way station", "路边祭亭里的圣船台", (0, 1.6, -72), (0, 0.5, -77.4))


# ── the pylon ────────────────────────────────────────────────────────────────

def _pylon(s: Site) -> None:
    s.floor(-36, -40, 36, -33, F_COURT, cols=FLOOR)
    s.floor(-2.8, -33, 2.8, -24, F_COURT, cols=FLOOR)
    for sign in (-1, 1):
        s.block(sign * 5.5, -33, sign * 31, -24, 0, 30, bat=2.4, ends=True, cor=True, tor=True, tex="pylon", c=STONE)
        s.block(sign * 2.8, -32.4, sign * 5.5, -24.6, 0, 19, tex="relief", c=STONE)
        s.piece("pylon_relief", sign * 18.25, 14.0, -33 + 2.4 * 14 / 30 - 0.06, S, w=19, h=21,
                tilt=round(math.atan2(2.4, 30), 4), flip=1 if sign > 0 else 0)
        for x in (11.0, 21.5):
            s.piece("flagpole", sign * x, F_OUT, -33.6, S, h=38, collide=("circle", 0.6, 38))
    s.block(-5.5, -32.4, 5.5, -24.6, 12.4, 19, cor=True, tex="relief", c=STONE)
    s.piece("portal", 0, F_COURT, -28.5, 0.0, w=5.6, h=12.1, th=7.8, c=STONE, disc=1)
    s.piece("gate_doors", 0, F_COURT, -28.5, 0.0, w=5.6, h=12.0, depth=7.8)

    s.room("pylon", "The Pylon", "塔门", (0, F_COURT, -46), S,
           ("Two towers stand for the hills of the horizon; the sun rose between them.",
            "两座塔代表地平线上的两座山，太阳从它们之间升起。"))
    s.piece("obelisk", -27.5, F_COURT, -37.5, S, h=24, collide=("rect", 3.8, 3.8, 26))
    s.locus("West obelisk, tipped with electrum", "西方尖碑（金银合金尖顶）", (-27.5, 8, -37.5), (-27.5, F_OUT, -48.5))
    s.piece("colossus", -10, F_COURT, -37.5, S, pose="seat", collide=("rect", 4.6, 6.6, 12))
    s.locus("Seated colossus of the king", "国王坐像巨像", (-10, 6, -37.5), (-10, F_OUT, -47.5))
    s.locus("The great gate and its cedar doors", "大门与雪松木门扇", (0, 6, -30), (0, F_COURT, -39.5))
    s.piece("colossus", 10, F_COURT, -37.5, S, pose="stand", collide=("rect", 4.0, 5.0, 12))
    s.locus("Standing colossus in the double crown", "戴双冠的国王立像巨像", (10, 6, -37.5), (10, F_OUT, -47.5))
    s.piece("obelisk", 27.5, F_COURT, -37.5, S, h=21, collide=("rect", 3.8, 3.8, 23))
    s.locus("East obelisk, the shorter twin", "东方尖碑（较矮的那根）", (27.5, 8, -37.5), (27.5, F_OUT, -48.5))


# ── court of offerings ───────────────────────────────────────────────────────

COURT_CAPS = ["open", "composite", "palm", "lotus", "composite2", "open2", "papyrus_bud", "composite3"]


def _court(s: Site) -> None:
    s.floor(-26, -24, 26, 16, F_COURT, cols=FLOOR)
    # enclosure wall, with the east gate to the sacred lake
    s.block(-28, -24, -26, 92, 0, 13.5, cor=True, tor=True, c=STONE)
    s.wall_z(26, 28, -24, 92, 13.5, doors=[(0.0, 4.0, 6.4)], cor=True, tor=True, c=STONE)
    s.block(-28, 90, 28, 92, 0, 13.5, cor=True, tor=True, c=STONE)
    # colonnade on the west, east and pylon sides
    k = 0
    for x in (-20.6, 20.6):
        for i in range(8):
            s.column(x, -18.6 + 4.6 * i, F_COURT, 10.0, 0.85, COURT_CAPS[k % len(COURT_CAPS)])
            k += 1
        s.beam(x, -19.6, x, 14.6, 10.3, w=1.5, h=1.1)
    for x in (-15.4, -10.2, -5.0, 5.0, 10.2, 15.4):
        s.column(x, -18.6, F_COURT, 10.0, 0.85, COURT_CAPS[k % len(COURT_CAPS)])
        k += 1
    s.beam(-21.4, -18.6, 21.4, -18.6, 10.3, w=1.5, h=1.1)
    s.roof(-26, -24, -19.75, 14.4, 11.4)
    s.roof(19.75, -24, 26, 14.4, 11.4)
    s.roof(-19.75, -24, 19.75, -17.8, 11.4)

    s.wing("temple", "The Temple", "神庙", (0, F_COURT, 0))
    s.room("court", "Court of Offerings", "献祭庭院", (0, F_COURT, -21.5), S,
           ("The last place open to the sky. Offerings were laid out here on feast days.",
            "最后一处露天的地方。节日里，祭品陈列在这里。"))
    s.piece("lustration_basin", -13, F_COURT, -13, E, collide=("rect", 2.4, 1.6, 1.4))
    s.locus("Basin for washing before entering", "入殿前净手的石盆", (-13, 1.2, -13), (-9.2, F_COURT, -13))
    s.piece("stela", -24.6, F_COURT, -2.5, E, collide=("rect", 2.6, 1.0, 4.4))
    s.locus("Founding stela under the west colonnade", "西柱廊下的建庙碑", (-24.6, 2.5, -2.5), (-17.6, F_COURT, -2.5))
    s.piece("falcon", -5.6, F_COURT, 12.6, S, crown="double", collide=("rect", 2.4, 3.0, 5))
    s.locus("Granite falcon wearing the double crown", "戴双冠的花岗岩荷鲁斯隼", (-5.6, 3, 12.6), (-5.6, F_COURT, 6.6))
    s.piece("altar", 0, F_COURT, 2.5, S, collide=("rect", 4.4, 3.4, 2.0))
    s.locus("The great altar of burnt offerings", "燔祭大祭坛", (0, 1.5, 2.5), (0, F_COURT, -3.6))
    s.piece("falcon", 5.6, F_COURT, 12.6, S, crown="disc", collide=("rect", 2.4, 3.0, 5))
    s.locus("Granite falcon carrying the sun disc", "顶着日轮的花岗岩荷鲁斯隼", (5.6, 3, 12.6), (5.6, F_COURT, 6.6))
    s.piece("offering_table", 13, F_COURT, -2.5, W, collide=("rect", 2.8, 1.6, 1.4))
    s.locus("Offering table heaped with food", "堆满食物的供桌", (13, 1.1, -2.5), (9.4, F_COURT, -2.5))
    s.piece("brazier", 13, F_COURT, -13, W, collide=("circle", 0.9, 2.4))
    s.locus("Bronze incense burner", "青铜香炉", (13, 1.6, -13), (9.6, F_COURT, -13))


# ── pronaos (first hypostyle hall) ───────────────────────────────────────────

PRONAOS_CAPS = ["composite", "palm", "composite2", "open", "lotus", "composite3",
                "papyrus_bud", "composite", "open2", "palm", "composite3", "lotus",
                "composite2", "open", "composite", "palm", "composite3", "open2"]


def _pronaos(s: Site) -> None:
    s.floor(-19, 16, 19, 35, F_PRO, cols=FLOOR_IN)
    for sign in (-1, 1):
        s.block(sign * 19, 16, sign * 21, 35, 0, 17.6, cor=True, tor=True, c=STONE)
    s.wall_x(33.6, 35, -21, 21, 17.6, doors=[(0.0, 4.4, 9.2)], c=STONE_IN)
    xs = (-16.4, -10.2, -3.6, 3.6, 10.2, 16.4)
    k = 0
    for z in (17.0, 23.2, 29.0):
        for x in xs:
            gilt = z == 29.0 and x == 10.2
            s.column(x, z, F_PRO, 14.0, 1.05, "hathor" if gilt else PRONAOS_CAPS[k], gilt=1 if gilt else None)
            k += 1
        s.beam(-19, z, 19, z, 14.6, w=1.7, h=1.2)
    # screen walls between the front columns; a broken-lintel door in the middle
    for sign in (-1, 1):
        for a, b in ((4.65, 9.15), (11.25, 15.35), (17.45, 19.0)):
            s.block(sign * a, 16.5, sign * b, 17.5, 0, 6.6, cor=True, tex="relief", c=STONE)
        s.block(sign * 1.8, 16.4, sign * 2.55, 17.6, 0, 6.6, cor=True, tex="relief", c=STONE)
    s.block(-21, 16, 21, 18, 14.6, 17.6, cor=True, tex="relief", c=STONE, top="disc")
    s.roof(-19, 18, 19, 33.6, 15.8, th=1.2)

    # the House of Books (west) and the robing room (east), small chambers by the door
    for sign in (-1, 1):
        x_out, x_in = sign * 19, sign * 13.4
        s.block(x_out, 18.2, x_in, 18.8, 0, 6.6, tex="relief", c=STONE_IN)
        s.block(x_out, 21.2, x_in, 21.9, 0, 6.6, tex="relief", c=STONE_IN)
        s.wall_z(sign * 14.1, sign * 13.4, 18.8, 21.2, 6.6, doors=[(20.0, 1.8, 3.6)], tex="relief", c=STONE_IN)
        s.roof(x_out, 18.2, x_in, 21.9, 6.0, th=0.6)

    s.room("pronaos", "Pronaos", "前厅（第一多柱厅）", (0, F_PRO, 18.6), S,
           ("A forest of eighteen columns, each capital a different plant: the marsh where creation began.",
            "十八根柱子组成的石林，每个柱头是不同的植物：象征创世之初的沼泽。"), light=0.62)
    s.piece("library", -18.4, F_PRO, 20.0, E, collide=("rect", 2.4, 0.9, 3.4))
    s.locus("The House of Books: chests of sacred papyri", "藏书室：盛放神圣纸草卷的木箱", (-18.4, 1.8, 20.0),
            (-15.2, F_PRO, 20.0))
    s.piece("king_kneeling", -13.3, F_PRO, 26.1, E, collide=("rect", 1.6, 1.6, 3))
    s.locus("Statue of the king kneeling with wine jars", "跪捧酒罐的国王像", (-13.3, 1.8, 26.1), (-9.6, F_PRO, 26.1))
    s.piece("incense_altar", 0, F_PRO, 31.4, S, collide=("rect", 1.6, 1.6, 2.0))
    s.locus("Incense altar before the inner door", "内门前的焚香台", (0, 1.8, 31.4), (0, F_PRO, 27.6))
    s.locus("Gilded column with the face of Hathor", "饰有哈托尔面孔的镀金柱", (10.2, 5.2, 29.0), (6.4, F_PRO, 29.0))
    s.piece("robing", 18.4, F_PRO, 20.0, W, collide=("rect", 2.4, 0.9, 3.0))
    s.locus("Robing room: the god's linen and crowns", "更衣室：神的亚麻衣与王冠", (18.4, 1.8, 20.0),
            (15.2, F_PRO, 20.0))


# ── hall of appearances (second hypostyle hall) ──────────────────────────────

def _hypostyle(s: Site) -> None:
    s.floor(-19, 35, 19, 48.4, F_HYP, cols=FLOOR_IN)
    for sign in (-1, 1):
        s.block(sign * 19, 35, sign * 21, 87, 0, 14, cor=True, tor=True, c=STONE)
        s.wall_z(sign * 13.6, sign * 12.2, 35, 47, 12.9, doors=[(37.8, 1.8, 4.6), (44.4, 1.8, 4.6)], c=STONE_IN)
        s.block(sign * 19, 40.6, sign * 13.6, 41.8, 0, 8.4, c=STONE_IN)
        s.roof(sign * 19, 35, sign * 13.6, 47, 7.6, th=0.8)
    s.wall_x(47, 48.4, -19, 19, 12.9, doors=[(0.0, 3.6, 7.4)], c=STONE_IN)
    caps = ["open", "composite", "palm", "composite2", "lotus", "open2", "composite3", "papyrus_bud",
            "composite", "palm", "open", "composite2"]
    k = 0
    for z in (37.9, 41.0, 44.1):
        for x in (-8.6, -3.6, 3.6, 8.6):
            s.column(x, z, F_HYP, 10.0, 0.78, caps[k])
            k += 1
        s.beam(-12.2, z, 12.2, z, 10.9, w=1.3, h=1.0)
    s.roof(-12.2, 35, 12.2, 47, 11.9)
    s.piece("light_shaft", 0, F_HYP, 41.0, 0.0, top=11.9, w=1.2, d=9)

    s.room("appearances", "Hall of Appearances", "显现大厅（第二多柱厅）", (0, F_HYP, 36.0), S,
           ("Here the god came out in his barque on feast days. The side rooms served the ritual.",
            "节日里，神乘圣船从这里出巡。两侧小室为祭仪服务。"), light=0.46)
    s.piece("laboratory", -17.6, F_HYP, 37.8, E, collide=("rect", 3.0, 2.0, 2.6))
    s.locus("Laboratory: perfumes and sacred oils", "实验室：调制香膏与圣油", (-17.6, 2, 37.8), (-14.4, F_HYP, 37.8))
    s.piece("treasury", -17.6, F_HYP, 44.4, E, collide=("rect", 3.0, 2.0, 2.4))
    s.locus("Treasury: chests of gold and amulets", "宝库：黄金与护身符箱", (-17.6, 2, 44.4), (-14.4, F_HYP, 44.4))
    s.piece("portable_barque", 0, F_HYP, 42.4, S, collide=("rect", 2.2, 5.6, 3.2))
    s.locus("Portable barque on its carrying poles", "架在抬杠上的便携圣船", (0, 2.4, 42.4), (0, F_HYP, 36.6))
    s.piece("nile_room", 17.6, F_HYP, 44.4, W, collide=("rect", 3.0, 2.0, 2.4))
    s.locus("Nile room: jars of pure river water", "尼罗河室：盛着圣水的陶罐", (17.6, 2, 44.4), (14.4, F_HYP, 44.4))
    s.piece("storeroom", 17.6, F_HYP, 37.8, W, collide=("rect", 3.0, 2.0, 2.4))
    s.locus("Storeroom of grain, bread and fruit", "储藏室：谷物、面包与水果", (17.6, 2, 37.8), (14.4, F_HYP, 37.8))


# ── offering hall ────────────────────────────────────────────────────────────

def _offering_hall(s: Site) -> None:
    s.floor(-19, 48.4, 19, 56.8, F_OFF, cols=FLOOR_IN)
    for sign in (-1, 1):
        s.wall_z(sign * 13.6, sign * 12.2, 48.4, 55.4, 11.2, doors=[(51.4, 1.8, 4.4)], c=STONE_IN)
        s.roof(sign * 19, 48.4, sign * 13.6, 55.4, 7.6, th=0.8)
    s.wall_x(55.4, 56.8, -19, 19, 11.2, doors=[(0.0, 3.2, 6.6)], c=STONE_IN)
    s.roof(-12.2, 48.4, 12.2, 55.4, 10.2)
    s.piece("light_shaft", 0, F_OFF, 52.0, 0.0, top=10.2, w=0.9, d=4)

    s.room("offering", "Offering Hall", "供奉厅", (0, F_OFF, 49.2), S,
           ("The god's daily meals were set out here. Stairs led up to the roof for the New Year feast.",
            "神每天的饭食在这里摆放。两侧楼梯通往屋顶，新年节时神像被抬上屋顶迎接太阳。"), light=0.4)
    s.piece("stair", -16.4, F_OFF, 51.4, W, rise=3.6, width=2.6, length=4.8, style="winding",
            collide=("rect", 2.6, 4.8, 4))
    s.locus("West stair, winding up to the roof", "西楼梯：盘旋通向屋顶", (-16.4, 2.5, 51.4), (-11.6, F_OFF, 51.4))
    s.piece("offering_feast", 0, F_OFF, 52.4, S, collide=("rect", 3.6, 1.8, 1.6))
    s.locus("The god's daily meal on the offering table", "供桌上神的每日饭食", (0, 1.9, 52.4), (0, F_OFF, 49.0))
    s.piece("stair", 16.4, F_OFF, 51.4, E, rise=3.6, width=2.6, length=4.8, style="straight",
            collide=("rect", 2.6, 4.8, 4))
    s.locus("East stair, straight down from the roof", "东楼梯：笔直地从屋顶下来", (16.4, 2.5, 51.4), (11.6, F_OFF, 51.4))


# ── hall of the Ennead ───────────────────────────────────────────────────────

def _ennead(s: Site) -> None:
    s.floor(-19, 56.8, 19, 64, F_ENN, cols=FLOOR_IN)
    for sign in (-1, 1):
        s.wall_z(sign * 13.6, sign * 12.2, 56.8, 62.6, 10.2, doors=[(59.7, 1.8, 4.2)], c=STONE_IN)
        s.roof(sign * 19, 56.8, sign * 13.6, 62.6, 7.4, th=0.8)
    s.wall_x(62.6, 64, -19, 19, 10.2, doors=[(-7.6, 2.0, 4.6), (0.0, 3.2, 6.2), (7.6, 2.0, 4.6)], c=STONE_IN)
    s.roof(-12.2, 56.8, 12.2, 62.6, 9.2)

    s.room("ennead", "Hall of the Ennead", "九神厅", (0, F_ENN, 57.6), S,
           ("The antechamber of the sanctuary, where the nine gods of creation kept watch.",
            "圣殿的前室，创世九神在这里守候。"), light=0.34)
    s.piece("min_chapel", -17.4, F_ENN, 59.7, E, collide=("rect", 2.6, 2.2, 3.4))
    s.locus("Chapel of Min: the tall plumed crown", "敏神小堂：高耸的羽冠", (-17.4, 2.5, 59.7), (-14.2, F_ENN, 59.7))
    s.piece("ennead", -4.2, F_ENN, 61.9, S, collide=("rect", 4.8, 1.1, 1.8))
    s.locus("The nine gods of creation on their bench", "长凳上的创世九神", (-4.2, 2.2, 61.9), (-4.2, F_ENN, 58.2))
    s.piece("linen_room", 17.4, F_ENN, 59.7, W, collide=("rect", 2.6, 2.2, 3.0))
    s.locus("Linen room: folded cloth for the god", "布料室：为神叠好的亚麻布", (17.4, 2.2, 59.7), (14.2, F_ENN, 59.7))


# ── sanctuary and the corridor of mysteries ──────────────────────────────────

CHAPELS_W = [("khonsu", "Chapel of Khonsu, the moon", "月神孔苏小堂"),
             ("hathor", "Chapel of Hathor, Horus's wife", "哈托尔小堂（荷鲁斯之妻）"),
             ("isis", "Chapel of Isis, his mother", "伊西斯小堂（荷鲁斯之母）")]
CHAPELS_BACK = [("osiris", "Chapel of Osiris, his father", "奥西里斯小堂（荷鲁斯之父）"),
                ("wings", "Chapel of the Spread Wings", "展翼小堂"),
                ("sokar", "Chapel of Sokar's barque", "索卡尔圣船小堂")]
CHAPELS_E = [("ra", "Chapel of Ra, the sun", "太阳神拉小堂"),
             ("throne", "Chapel of the Throne of the Gods", "众神宝座小堂"),
             ("victor", "Chapel of Horus the Victor", "胜利者荷鲁斯小堂")]
SIDE_Z = [(64.0, 68.6), (69.6, 74.2), (75.2, 79.8)]


def _sanctuary(s: Site) -> None:
    s.floor(-19, 64, 19, 85.6, F_SAN, cols=FLOOR_IN)
    # the sanctuary: a house within the house
    for sign in (-1, 1):
        s.block(sign * 6.4, 64, sign * 5, 77.4, 0, 9.8, c=STONE_IN)
    s.block(-6.4, 76, 6.4, 77.4, 0, 9.8, c=STONE_IN)
    s.roof(-5, 64, 5, 76, 8.0)
    # corridor of mysteries and its chapels
    for sign in (-1, 1):
        s.roof(sign * 6.4, 64, sign * 8.8, 77.4, 6.6, th=0.8)
        s.wall_z(sign * 8.8, sign * 10.2, 64, 79.8, 7.4, doors=[(66.3, 1.8, 4.0), (71.9, 1.8, 4.0), (77.5, 1.8, 4.0)],
                 c=STONE_IN)
        for za, zb in ((68.6, 69.6), (74.2, 75.2)):
            s.block(sign * 10.2, za, sign * 19, zb, 0, 7.4, c=STONE_IN)
        s.roof(sign * 10.2, 64, sign * 19, 79.8, 6.6, th=0.8)
        s.block(sign * 2.4, 81.2, sign * 3.4, 85.6, 0, 7.4, c=STONE_IN)
        s.block(sign * 8.8, 81.2, sign * 10.2, 85.6, 0, 7.4, c=STONE_IN)
        s.roof(sign * 10.2, 79.8, sign * 19, 85.6, 6.6, th=0.8)
    s.roof(-8.8, 77.4, 8.8, 79.8, 6.6, th=0.8)
    s.wall_x(79.8, 81.2, -19, 19, 7.4, doors=[(-6.1, 1.8, 4.0), (0.0, 1.8, 4.0), (6.1, 1.8, 4.0)], c=STONE_IN)
    s.roof(-8.8, 79.8, 8.8, 85.6, 6.6, th=0.8)
    s.block(-21, 85.6, 21, 87, 0, 14, cor=True, tor=True, c=STONE)
    # lamps light the dark inner rooms
    for x, z, yaw in ((-6.42, 66.3, W), (-6.42, 71.9, W), (-3.5, 77.42, N), (3.5, 77.42, N), (6.42, 71.9, E),
                      (6.42, 66.3, E)):
        s.piece("wall_lamp", x, F_SAN, z, yaw)

    s.wing("sanctuary", "The Sanctuary", "圣殿", (0, F_SAN, 72))
    s.room("naos", "Sanctuary", "至圣所", (0, F_SAN, 64.6), S,
           ("Only the high priest entered, at dawn, to wake the god in his shrine.",
            "只有大祭司能进入：每天黎明，他来这里唤醒神龛中的神。"), light=0.26)
    s.piece("sacred_barque", 0, F_SAN, 68.4, S, collide=("rect", 1.9, 5.2, 3.6))
    s.locus("The sacred barque on its granite pedestal", "花岗岩台座上的圣船", (0, 2.6, 68.4), (-3.6, F_SAN, 65.4))
    s.piece("naos", 0, F_SAN, 74.9, S, collide=("rect", 2.2, 1.8, 4.6))
    s.locus("The granite naos of Nectanebo II", "内克塔内布二世的花岗岩神龛", (0, 2.4, 74.9), (0, F_SAN, 72.4))

    s.room("mysteries", "Corridor of Mysteries", "秘仪回廊", (-7.6, F_SAN, 64.8), S,
           ("A passage around the sanctuary, opening onto chapels of the gods of Horus's family and myth.",
            "环绕圣殿的走廊，两侧小堂供奉荷鲁斯家族与神话中的众神。"), light=0.26)
    for (kind, en, zh), (za, zb) in zip(CHAPELS_W, SIDE_Z):
        zc = (za + zb) / 2
        s.piece(kind, -16.6, F_SAN, zc, E, collide=("rect", 3.0, 3.0, 3.6))
        s.locus(en, zh, (-16.6, 3.0, zc), (-12.4, F_SAN, zc))
    for (kind, en, zh), xc in zip(CHAPELS_BACK, (-6.1, 0.0, 6.1)):
        s.piece(kind, xc, F_SAN, 84.0, S, collide=("rect", 3.6, 2.4, 3.6))
        s.locus(en, zh, (xc, 3.0, 84.0), (xc, F_SAN, 81.7))
    for (kind, en, zh), (za, zb) in zip(CHAPELS_E, reversed(SIDE_Z)):
        zc = (za + zb) / 2
        s.piece(kind, 16.6, F_SAN, zc, W, collide=("rect", 3.0, 3.0, 3.6))
        s.locus(en, zh, (16.6, 3.0, zc), (12.4, F_SAN, zc))


# ── ambulatory ───────────────────────────────────────────────────────────────

def _ambulatory(s: Site) -> None:
    for sign in (-1, 1):
        s.floor(sign * 21, 16, sign * 26, 90, F_COURT, cols=FLOOR)
    s.floor(-21, 87, 21, 90, F_COURT, cols=FLOOR)
    s.wing("precinct", "The Precinct", "神庙周边", (0, F_COURT, 88))
    s.room("ambulatory", "Ambulatory", "外围回廊", (-23.5, F_COURT, 18), S,
           ("A passage between the temple and its enclosure wall, carved with the myths of Horus.",
            "神庙与围墙之间的通道，墙上刻着荷鲁斯的神话。"))
    s.piece("relief_panel", -25.95, 1.4, 50, E, w=15, h=6.5, scene="triumph")
    s.locus("Relief: Horus spears Seth the hippopotamus", "浮雕：荷鲁斯刺杀化作河马的塞特", (-25.9, 4.5, 50),
            (-22.0, F_COURT, 50))
    s.piece("lion_spout", 21.0, 11.2, 60, E)
    s.locus("Lion-headed rain spout high on the wall", "高墙上的狮首排水口", (21.2, 11.4, 60), (25.0, F_COURT, 60))


# ── sacred lake ──────────────────────────────────────────────────────────────

def _lake(s: Site) -> None:
    s.floor(28, -16, 34, 16, 0.15, cols=FLOOR)
    for x0, z0, x1, z1 in ((34, 12, 68, 16), (34, -16, 68, -12), (34, -12, 40, 12), (64, -12, 68, 12)):
        s.floor(x0, z0, x1, z1, 0.15, cols=FLOOR)
    s.hole(40, -12, 64, 12)
    s.piece("lake", 52, 0.15, 0, 0.0, w=24, d=24, depth=3.4, water=2.6)
    s.hole(46, -22.5, 50, -18.5)
    s.piece("nilometer", 48, F_OUT, -20.5, 0.0, w=4, d=4, depth=7)

    s.room("lake", "Sacred Lake", "圣湖", (31, 0.15, 0), W,
           ("Priests bathed here before every service; the nilometer measured the coming flood.",
            "祭司每次主持仪式前都要在这里沐浴；尼罗河水位计用来测量即将到来的洪水。"))
    s.piece("scarab", 36.4, 0.15, 8.6, W, collide=("rect", 3.0, 3.6, 3.4))
    s.locus("Giant granite scarab of the rising sun", "象征旭日的巨型花岗岩圣甲虫", (36.4, 1.8, 8.6), (32.0, 0.15, 8.6))
    s.locus("Stairs down into the sacred lake", "走下圣湖的石阶", (41.5, -0.5, 0), (36.6, 0.15, 0))
    s.locus("The nilometer: a stair down to the river", "尼罗河水位计：通往河水的阶梯", (48, -1.0, -20.5), (48, 0.15, -14.4))


# ── palms ────────────────────────────────────────────────────────────────────

def _palms(s: Site) -> None:
    rng = random.Random(1237)
    spots: list[tuple[float, float]] = []
    # double rows outside the sphinxes
    for z in range(-100, -42, 7):
        for x in (14.5, 20.0):
            for sign in (-1, 1):
                spots.append((sign * x + rng.uniform(-0.8, 0.8), z + rng.uniform(-1.2, 1.2)))
    # along the quay
    for x in range(-40, 41, 8):
        if abs(x) > 26:
            spots.append((x + rng.uniform(-1, 1), -108 + rng.uniform(-2, 2)))
    # around the sacred lake
    for x in range(36, 70, 6):
        spots.append((x + rng.uniform(-1, 1), 19.5 + rng.uniform(-1, 1)))
        spots.append((x + rng.uniform(-1, 1), -27.5 + rng.uniform(-1, 1)))
    for z in range(-10, 14, 6):
        spots.append((72 + rng.uniform(-1, 1), z + rng.uniform(-1, 1)))
    # groves beyond the enclosure
    for cx, cz, n in ((-52, -10, 16), (-48, 40, 14), (-60, 78, 12), (60, 60, 14), (78, -40, 10), (-46, -70, 12),
                      (46, -78, 12), (0, 118, 14), (-30, 112, 8), (34, 108, 8)):
        for _ in range(n):
            spots.append((cx + rng.uniform(-11, 11), cz + rng.uniform(-11, 11)))
    for x, z in spots:
        s.piece("palm", x, F_OUT, z, rng.uniform(0, 2 * PI), h=round(rng.uniform(7.5, 12.5), 1),
                lean=round(rng.uniform(-0.12, 0.12), 3), seed=rng.randint(1, 9999), collide=("circle", 0.45, 10))
