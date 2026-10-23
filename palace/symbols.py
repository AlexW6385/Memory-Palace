"""Fixed vocabularies shared by the content schema, the LLM prompts and the 3D viewer.

The viewer (web/js/symbols.js) implements one procedural mesh per symbol name,
so every name here must have a matching builder there.
"""

# name -> what the shape is good at standing for (used in LLM prompts)
SYMBOLS: dict[str, str] = {
    "sphere": "圆满、整体、存在本身",
    "cube": "实体、结构、数据块",
    "pyramid": "层级、基础、金字塔式结构",
    "cone": "方向、聚焦、收敛",
    "cylinder": "容器、存储、柱石",
    "torus": "循环、回路、周期",
    "ring": "闭环、约束、代数结构",
    "crystal": "纯粹概念、精确定义",
    "gem": "精华、关键定理、宝贵结论",
    "dodeca": "多面性、复杂整体",
    "knot": "纠缠、复杂关联、难点",
    "spiral": "螺旋上升、递归、辩证发展",
    "twin": "对立、二元、一对概念",
    "arrow": "推导、因果、映射",
    "stairs": "阶段、递进、逐级上升",
    "tree": "树结构、层次、生长",
    "book": "文本、定义、规范、法",
    "scale": "平衡、权衡、正义",
    "gear": "机制、运转、引擎",
    "key": "关键、钥匙、密码与安全",
    "eye": "观察、意识、注意力",
    "flame": "能量、否定、毁灭与新生",
    "hourglass": "时间、过程、复杂度",
    "bulb": "想法、洞见、启发",
    "network": "图、网络、连接",
    "wave": "波、信号、振荡",
    "infinity": "无限、极限、无穷",
    "mirror": "反思、反映、对称",
    "door": "入口、过渡、接口",
    "crown": "顶点、最高阶段、绝对",
    "shield": "防护、测试、安全保障",
    "lattice": "网格、矩阵、晶格",
    "layers": "分层、栈、协议层",
    "chain": "链条、序列、依赖",
    "compass": "导航、规划、方向",
    "atom": "基本单元、原子性、粒子",
}

# name -> how the template arranges a knowledge system (used in LLM prompts)
TEMPLATES: dict[str, str] = {
    "spiral": "螺旋上升的塔：一条盘旋向上的坡道，按顺序一路向上，适合有明确发展顺序、层层扬弃的体系（如哲学体系、历史发展）",
    "city": "城市：每个分区是一个街区，街区里是一座座展馆，适合并列的若干大领域（如数学各分支）",
    "terraces": "阶梯金字塔：从底层平台逐级登高，适合有抽象层次、上层依赖下层的体系（如计算机从硬件到理论）",
    "avenue": "长街：沿一条街道按流程依次经过各个工坊，适合有先后流程的实践体系（如软件开发生命周期）",
    "radial": "放射状广场：中央枢纽向四周辐射出多条长廊，适合一个核心概念衍生出多个方向（如大模型与 Agent）",
}
