import type { Ingredient } from "./types";
import {
  generateRecipeWithLLM,
  adjustRecipeWithLLM,
  isLLMConfigured,
  type LLMRecipeResult,
} from "./llm";

export interface RawStep {
  description: string;
  ingredients: Ingredient[];
  duration: number;
}

export interface GeneratedRecipe {
  title: string;
  summary: string;
  source_links: string[];
  steps: RawStep[];
}

const RECIPE_DATABASE: Record<string, GeneratedRecipe> = {
  红烧肉: {
    title: "经典红烧肉",
    summary: "色泽红亮、肥而不腻、入口即化的传统名菜",
    source_links: [],
    steps: [
      {
        description:
          "五花肉洗净后切成 3cm 见方的块，冷水下锅，加入料酒和几片姜，大火煮开后撇去浮沫，焯水 3 分钟后捞出沥干备用。",
        ingredients: [
          { name: "五花肉", amount: "500g" },
          { name: "料酒", amount: "2汤匙" },
          { name: "姜片", amount: "3片" },
        ],
        duration: 300,
      },
      {
        description:
          "炒锅中火加热，不放油，将焯好水的五花肉块表面煎至微微焦黄，逼出多余油脂。翻面均匀煎制约 3-4 分钟。",
        ingredients: [],
        duration: 240,
      },
      {
        description:
          "锅中留底油，放入冰糖小火炒至琥珀色起大泡，动作要快以防炒焦。这一步是红烧肉色泽的关键。",
        ingredients: [
          { name: "冰糖", amount: "30g", substitute: "白砂糖 20g" },
        ],
        duration: 180,
      },
      {
        description:
          "下入五花肉翻炒裹上糖色，加葱段、姜片、八角、桂皮、香叶炒香。沿锅边淋入生抽、老抽上色，倒入开水没过肉块。",
        ingredients: [
          { name: "葱段", amount: "2根" },
          { name: "八角", amount: "2颗" },
          { name: "桂皮", amount: "1小段" },
          { name: "生抽", amount: "2汤匙" },
          { name: "老抽", amount: "1汤匙" },
        ],
        duration: 120,
      },
      {
        description:
          "大火烧开后转小火，盖上锅盖慢炖 60 分钟。开盖后转大火收汁至浓稠裹在肉表面，加少许盐调味出锅。",
        ingredients: [{ name: "盐", amount: "适量" }],
        duration: 3600,
      },
    ],
  },
  番茄炒蛋: {
    title: "家常番茄炒蛋",
    summary: "酸甜可口、色泽鲜艳的国民家常菜",
    source_links: [],
    steps: [
      {
        description:
          "鸡蛋打入碗中加少许盐和料酒搅打蓬松。番茄顶部划十字，开水烫 30 秒去皮切块。",
        ingredients: [
          { name: "鸡蛋", amount: "3个" },
          { name: "番茄", amount: "2个" },
          { name: "盐", amount: "少许" },
        ],
        duration: 180,
      },
      {
        description:
          "多油七成热倒入蛋液，底部凝固后推散成大块，略带流动时盛出。",
        ingredients: [{ name: "食用油", amount: "3汤匙" }],
        duration: 60,
      },
      {
        description:
          "留底油中火炒番茄块，按压出汁至软烂出沙，加白糖提鲜。倒回鸡蛋翻匀，加盐撒葱花出锅。",
        ingredients: [
          { name: "白糖", amount: "1茶匙" },
          { name: "葱花", amount: "适量" },
        ],
        duration: 180,
      },
    ],
  },
  宫保鸡丁: {
    title: "正宗宫保鸡丁",
    summary: "麻辣鲜香、花生酥脆的经典川菜",
    source_links: [],
    steps: [
      {
        description:
          "鸡胸肉切 1.5cm 丁，加盐、料酒、蛋清和淀粉抓匀腌 15 分钟。花生米炒熟，黄瓜切丁。",
        ingredients: [
          { name: "鸡胸肉", amount: "300g", substitute: "鸡腿肉更嫩" },
          { name: "花生米", amount: "50g" },
          { name: "淀粉", amount: "1汤匙" },
        ],
        duration: 900,
      },
      {
        description:
          "调碗汁：生抽 2 匙、醋 2 匙、糖 1 匙、淀粉 1 茶匙、水 2 匙混合。这是灵魂酱汁。",
        ingredients: [
          { name: "生抽", amount: "2汤匙" },
          { name: "香醋", amount: "2汤匙" },
          { name: "白糖", amount: "1汤匙" },
        ],
        duration: 60,
      },
      {
        description:
          "六成热油滑散鸡丁捞出。底油小火爆香干辣椒段和花椒至变色，下葱姜蒜末炒香。",
        ingredients: [
          { name: "干辣椒", amount: "8-10个" },
          { name: "花椒", amount: "1茶匙" },
        ],
        duration: 180,
      },
      {
        description:
          "倒回鸡丁大火翻炒，淋入碗汁迅速翻匀，撒入花生米和黄瓜丁翻炒几下出锅。",
        ingredients: [
          { name: "葱", amount: "2根" },
          { name: "蒜", amount: "3瓣" },
        ],
        duration: 120,
      },
    ],
  },
  蛋糕: {
    title: "经典戚风蛋糕",
    summary: "松软绵密、入口即化的烘焙基础款",
    source_links: [],
    steps: [
      {
        description:
          "蛋黄蛋清分离，蛋黄加 20g 细砂糖搅匀，依次加入牛奶和植物油搅拌至乳化，筛入低筋面粉 Z 字型拌匀成细腻面糊。",
        ingredients: [
          { name: "鸡蛋", amount: "5个（室温）" },
          { name: "低筋面粉", amount: "85g" },
          { name: "细砂糖", amount: "60g（分两份）" },
          { name: "纯牛奶", amount: "50ml" },
          { name: "植物油", amount: "40ml", substitute: "玉米油最佳" },
        ],
        duration: 300,
      },
      {
        description:
          "蛋清中加几滴柠檬汁，用电动打蛋器高速打发，分三次加入 40g 细砂糖，打至硬性发泡（提起打蛋器呈直立尖角）。",
        ingredients: [
          { name: "柠檬汁", amount: "几滴", substitute: "白醋几滴" },
        ],
        duration: 300,
      },
      {
        description:
          "取 1/3 蛋白霜到蛋黄糊中翻拌均匀，再倒回剩余蛋白霜中，用刮刀从底部翻拌（切勿画圈搅拌以防消泡）。",
        ingredients: [],
        duration: 120,
      },
      {
        description:
          "面糊从高处倒入 8 寸戚风模具，轻震两下排气泡。烤箱提前预热 150°C，中下层烘烤 60 分钟。",
        ingredients: [
          { name: "8寸戚风模具", amount: "1个（不粘模不可）" },
        ],
        duration: 3600,
      },
      {
        description:
          "出炉后立即倒扣在烤架上，完全冷却后（约 2 小时）用脱模刀沿模具边缘划一圈，轻轻推出底部脱模。",
        ingredients: [],
        duration: 7200,
      },
    ],
  },
  提拉米苏: {
    title: "经典意式提拉米苏",
    summary: "浓郁丝滑、咖啡与芝士的完美邂逅",
    source_links: [],
    steps: [
      {
        description:
          "浓缩咖啡冲泡 200ml 放凉，加入 1 汤匙朗姆酒拌匀备用。手指饼干准备好。",
        ingredients: [
          { name: "浓缩咖啡", amount: "200ml" },
          { name: "朗姆酒", amount: "1汤匙", substitute: "可省略" },
          { name: "手指饼干", amount: "200g" },
        ],
        duration: 300,
      },
      {
        description:
          "蛋黄 3 个加 60g 细砂糖隔热水打发至浓稠泛白（约 70°C），离火后继续搅打至降温。加入马斯卡彭芝士 250g 拌匀。",
        ingredients: [
          { name: "蛋黄", amount: "3个" },
          { name: "细砂糖", amount: "60g" },
          { name: "马斯卡彭芝士", amount: "250g" },
        ],
        duration: 600,
      },
      {
        description:
          "淡奶油 150ml 打至六分发（有纹路但仍流动），分两次拌入芝士糊，轻柔翻拌均匀。",
        ingredients: [
          { name: "淡奶油", amount: "150ml" },
        ],
        duration: 180,
      },
      {
        description:
          "手指饼干快速蘸咖啡液（2 秒即可，不要泡软），铺一层在容器底部。铺一层芝士糊，再铺饼干再铺糊，共两层。",
        ingredients: [],
        duration: 300,
      },
      {
        description:
          "表面筛上可可粉，盖保鲜膜冷藏至少 4 小时（过夜最佳）。食用前再筛一层可可粉装饰。",
        ingredients: [
          { name: "可可粉", amount: "适量" },
        ],
        duration: 14400,
      },
    ],
  },
  麻婆豆腐: {
    title: "麻婆豆腐",
    summary: "麻辣鲜香、豆腐嫩滑的川菜经典",
    source_links: [],
    steps: [
      {
        description:
          "嫩豆腐切 2cm 方块，加少许盐入沸水焯 2 分钟去豆腥并定型，捞出沥干。",
        ingredients: [
          { name: "嫩豆腐", amount: "1盒（400g）" },
          { name: "盐", amount: "少许" },
        ],
        duration: 180,
      },
      {
        description:
          "锅中油热，下猪肉末炒散变色出香。加入郫县豆瓣酱 1.5 匙小火炒出红油，加蒜末和姜末炒香。",
        ingredients: [
          { name: "猪肉末", amount: "100g", substitute: "牛肉末更正宗" },
          { name: "郫县豆瓣酱", amount: "1.5汤匙" },
          { name: "蒜末", amount: "3瓣" },
        ],
        duration: 180,
      },
      {
        description:
          "加半碗水煮沸，轻轻放入豆腐块，中火煮 3 分钟入味。加生抽、少许糖调味，淋水淀粉勾芡至浓稠。",
        ingredients: [
          { name: "生抽", amount: "1汤匙" },
          { name: "水淀粉", amount: "适量" },
        ],
        duration: 240,
      },
      {
        description:
          "出锅装盘，撒上现磨花椒粉和葱花。花椒粉要最后撒，保留最鲜的麻香。",
        ingredients: [
          { name: "花椒粉", amount: "1茶匙" },
          { name: "葱花", amount: "适量" },
        ],
        duration: 30,
      },
    ],
  },
  糖醋排骨: {
    title: "糖醋排骨",
    summary: "外酥里嫩、酸甜开胃的经典菜",
    source_links: [],
    steps: [
      {
        description:
          "小排斩成 4cm 段，冷水下锅加姜片料酒焯水 5 分钟去血沫，捞出冲净沥干。",
        ingredients: [
          { name: "猪小排", amount: "500g" },
          { name: "料酒", amount: "2汤匙" },
          { name: "姜片", amount: "3片" },
        ],
        duration: 360,
      },
      {
        description:
          "排骨加盐、料酒、少许淀粉拌匀。油温六成热，下排骨炸至金黄定型捞出。升高油温复炸 30 秒，外酥里嫩。",
        ingredients: [
          { name: "淀粉", amount: "2汤匙" },
          { name: "食用油", amount: "适量（炸用）" },
        ],
        duration: 480,
      },
      {
        description:
          "调糖醋汁：醋 3 匙、糖 2 匙、生抽 1 匙、番茄酱 1 匙、水半碗混合。锅留底油倒入糖醋汁煮沸至冒大泡。",
        ingredients: [
          { name: "香醋", amount: "3汤匙" },
          { name: "白糖", amount: "2汤匙" },
          { name: "番茄酱", amount: "1汤匙" },
          { name: "生抽", amount: "1汤匙" },
        ],
        duration: 120,
      },
      {
        description:
          "下入炸好的排骨大火翻炒收汁，让每块排骨均匀裹上糖醋汁，撒白芝麻出锅。",
        ingredients: [
          { name: "白芝麻", amount: "适量" },
        ],
        duration: 120,
      },
    ],
  },
  清蒸鲈鱼: {
    title: "清蒸鲈鱼",
    summary: "鲜嫩清甜、原汁原味的粤式经典",
    source_links: [],
    steps: [
      {
        description:
          "鲈鱼去鳞去内脏，鱼身两面各划三刀方便入味。用料酒和少许盐腌制 10 分钟，鱼肚内塞入姜片和葱段。",
        ingredients: [
          { name: "鲈鱼", amount: "1条（约500g）" },
          { name: "料酒", amount: "1汤匙" },
          { name: "姜片", amount: "5片" },
          { name: "葱段", amount: "3根" },
        ],
        duration: 600,
      },
      {
        description:
          "盘底架两根筷子将鱼架空，水大火烧开后放入鱼，旺火蒸 8-9 分钟（按每 500g 8 分钟计算），关火虚蒸 2 分钟。",
        ingredients: [],
        duration: 660,
      },
      {
        description:
          "倒掉蒸鱼汤汁（有腥味），去掉旧的葱姜。鱼身铺上新的姜丝和葱丝，淋上蒸鱼豉油。",
        ingredients: [
          { name: "蒸鱼豉油", amount: "2汤匙" },
          { name: "姜丝", amount: "适量" },
          { name: "葱丝", amount: "适量" },
        ],
        duration: 60,
      },
      {
        description:
          "另起锅烧热油至冒烟，趁热浇在鱼身葱姜丝上，「滋啦」一声激出香味即可上桌。",
        ingredients: [
          { name: "食用油", amount: "3汤匙" },
        ],
        duration: 60,
      },
    ],
  },
  可乐鸡翅: {
    title: "可乐鸡翅",
    summary: "甜香入味、大人小孩都爱的快手菜",
    source_links: [],
    steps: [
      {
        description:
          "鸡翅中洗净，正反面各划两刀方便入味。冷水下锅加姜片焯水 2 分钟去血沫，捞出冲净。",
        ingredients: [
          { name: "鸡翅中", amount: "12个" },
          { name: "姜片", amount: "3片" },
        ],
        duration: 240,
      },
      {
        description:
          "锅中少许油，放入鸡翅中火煎至两面金黄。加姜片、蒜瓣、干辣椒炒香，倒入一罐可乐没过鸡翅。",
        ingredients: [
          { name: "可乐", amount: "330ml（一罐）" },
          { name: "蒜瓣", amount: "4瓣" },
          { name: "干辣椒", amount: "2个", substitute: "不吃辣可省略" },
        ],
        duration: 300,
      },
      {
        description:
          "加生抽 2 匙上色调味，大火烧开后转中小火煮 15-20 分钟。最后开大火收汁至浓稠，汤汁裹满鸡翅即可。",
        ingredients: [
          { name: "生抽", amount: "2汤匙" },
          { name: "老抽", amount: "半汤匙" },
        ],
        duration: 1200,
      },
    ],
  },
  酸辣粉: {
    title: "重庆酸辣粉",
    summary: "酸辣过瘾、Q弹爽滑的经典小吃",
    source_links: [],
    steps: [
      {
        description:
          "红薯粉条提前用温水泡软约 30 分钟（干硬粉需更久），或按包装指示处理。花生米炒熟切碎备用。",
        ingredients: [
          { name: "红薯粉条", amount: "100g" },
          { name: "花生米", amount: "30g" },
        ],
        duration: 1800,
      },
      {
        description:
          "调碗底：碗中放 1 匙辣椒油、2 匙香醋、1 匙生抽、半匙糖、蒜末、葱花，加 2 勺高汤（或热水）搅匀。",
        ingredients: [
          { name: "辣椒油", amount: "1汤匙" },
          { name: "香醋", amount: "2汤匙" },
          { name: "生抽", amount: "1汤匙" },
          { name: "白糖", amount: "半茶匙" },
          { name: "蒜末", amount: "2瓣" },
        ],
        duration: 120,
      },
      {
        description:
          "烧一锅水煮沸，下泡好的粉条煮 2-3 分钟至透明Q弹，捞入调好味的碗中。浇上热汤。",
        ingredients: [],
        duration: 240,
      },
      {
        description:
          "撒上碎花生、香菜、葱花和酸豆角。喜欢的话加一勺肉末臊子，拌匀开吃。",
        ingredients: [
          { name: "香菜", amount: "适量" },
          { name: "酸豆角", amount: "1汤匙", substitute: "榨菜末" },
        ],
        duration: 60,
      },
    ],
  },
  抹茶拿铁: {
    title: "冰抹茶拿铁",
    summary: "清新回甘、高颜值的人气饮品",
    source_links: [],
    steps: [
      {
        description:
          "抹茶粉 2g 过筛入碗（防结块），加入 30ml 约 80°C 的热水，用茶筅或小打蛋器 W 型快速搅打至无颗粒、表面起细腻泡沫。",
        ingredients: [
          { name: "抹茶粉", amount: "2g（约1茶匙）", substitute: "选日式抹茶粉" },
          { name: "热水", amount: "30ml（80°C）" },
        ],
        duration: 120,
      },
      {
        description:
          "杯中放入适量冰块至七分满，倒入冷鲜奶 200ml。根据口味加入 1-2 茶匙糖浆搅匀。",
        ingredients: [
          { name: "鲜牛奶", amount: "200ml", substitute: "燕麦奶风味更佳" },
          { name: "冰块", amount: "适量" },
          { name: "糖浆", amount: "1-2茶匙", substitute: "蜂蜜" },
        ],
        duration: 60,
      },
      {
        description:
          "将打好的抹茶液缓缓倒在牛奶表面，形成漂亮的分层效果。饮用前搅匀即可。",
        ingredients: [],
        duration: 30,
      },
    ],
  },
};

function llmResultToGenerated(result: LLMRecipeResult): GeneratedRecipe {
  return {
    title: result.title,
    summary: result.summary,
    source_links: [],
    steps: result.steps.map((s) => ({
      description: s.description,
      ingredients: s.ingredients || [],
      duration: s.duration || 120,
    })),
  };
}

export async function findRecipe(query: string): Promise<GeneratedRecipe> {
  const normalized = query.trim();

  // LLM 优先：有 API Key 时始终调用大模型生成
  if (isLLMConfigured()) {
    console.log(`[RecipeGen] LLM configured, calling LLM for "${normalized}"`);
    const llmResult = await generateRecipeWithLLM(normalized);
    if (llmResult) {
      console.log(`[RecipeGen] LLM returned recipe: "${llmResult.title}"`);
      return llmResultToGenerated(llmResult);
    }
    console.log("[RecipeGen] LLM failed, falling back to local DB");
  } else {
    console.log("[RecipeGen] No LLM configured, using local DB only");
  }

  // 本地知识库兜底
  for (const [key, recipe] of Object.entries(RECIPE_DATABASE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      console.log(`[RecipeGen] Local DB match: "${key}"`);
      return recipe;
    }
  }

  console.log(`[RecipeGen] No local match, using smart default for "${normalized}"`);
  return getSmartDefault(normalized);
}

function getSmartDefault(query: string): GeneratedRecipe {
  const isBaking =
    /蛋糕|面包|饼干|曲奇|泡芙|马卡龙|派|塔|吐司|甜甜圈|司康|慕斯/.test(query);
  const isDrink =
    /奶茶|咖啡|拿铁|果汁|smoothie|冰沙|柠檬水|茶|酸梅汤|豆浆/.test(query);
  const isSoup = /汤|羹|煲|炖盅|粥/.test(query);
  const isColdDish = /凉拌|沙拉|凉皮|皮蛋/.test(query);
  const isDessert = /布丁|果冻|冰淇淋|雪糕|甜品|糖水|芋圆|仙草/.test(query);
  const isNoodle = /面|粉|米线|意面|拉面|刀削|饺子|馄饨|包子|馒头/.test(query);

  if (isBaking) return getBakingDefault(query);
  if (isDrink) return getDrinkDefault(query);
  if (isSoup) return getSoupDefault(query);
  if (isColdDish) return getColdDishDefault(query);
  if (isDessert) return getDessertDefault(query);
  if (isNoodle) return getNoodleDefault(query);
  return getCookingDefault(query);
}

function getBakingDefault(query: string): GeneratedRecipe {
  return {
    title: query,
    summary: `香气四溢的${query}，烘焙新手也能成功`,
    source_links: [],
    steps: [
      {
        description: `准备所有原材料并精确称量。烘焙讲究配比精准，建议使用电子秤。鸡蛋提前回温至室温，面粉过筛备用。`,
        ingredients: [
          { name: "低筋面粉", amount: "适量" },
          { name: "鸡蛋", amount: "适量" },
          { name: "细砂糖", amount: "适量" },
          { name: "黄油", amount: "适量", substitute: "植物油（口感稍有不同）" },
        ],
        duration: 300,
      },
      {
        description: `按照${query}的要求混合干湿性材料。注意不要过度搅拌以免面筋过度发展，影响${query}的松软口感。`,
        ingredients: [
          { name: "泡打粉", amount: "适量", substitute: "小苏打" },
          { name: "牛奶", amount: "适量" },
        ],
        duration: 300,
      },
      {
        description: `将面糊/面团整理入模，轻震排除大气泡。烤箱提前 10 分钟预热至所需温度（通常 170-180°C）。`,
        ingredients: [
          { name: "烘焙模具", amount: "1个" },
        ],
        duration: 180,
      },
      {
        description: `送入预热好的烤箱烘烤。中途不要频繁开门。用牙签插入中心，拔出无湿面糊即可。出炉后倒扣冷却。`,
        ingredients: [],
        duration: 2400,
      },
    ],
  };
}

function getDrinkDefault(query: string): GeneratedRecipe {
  return {
    title: query,
    summary: `清爽可口的${query}，在家轻松自制`,
    source_links: [],
    steps: [
      {
        description: `准备基底材料。如需用到茶叶，先用适温热水冲泡，过滤取茶汤放凉备用。`,
        ingredients: [
          { name: "主要原料", amount: "适量" },
          { name: "纯净水", amount: "适量" },
        ],
        duration: 300,
      },
      {
        description: `按照${query}的特点调配风味。加入甜味剂搅匀至溶解，试尝调整甜度。`,
        ingredients: [
          { name: "糖浆", amount: "适量", substitute: "蜂蜜或代糖" },
          { name: "鲜牛奶", amount: "适量", substitute: "燕麦奶/椰奶" },
        ],
        duration: 120,
      },
      {
        description: `杯中加入冰块至七分满，依次倒入各层液体。若需分层效果，可沿杯壁缓缓倒入。装饰后即可享用。`,
        ingredients: [
          { name: "冰块", amount: "适量" },
        ],
        duration: 60,
      },
    ],
  };
}

function getSoupDefault(query: string): GeneratedRecipe {
  return {
    title: query,
    summary: `温润滋补的${query}，暖心暖胃`,
    source_links: [],
    steps: [
      {
        description: `主要食材处理干净。肉类需冷水下锅焯水去血沫和异味，捞出冲洗干净。`,
        ingredients: [
          { name: "主料", amount: "适量" },
          { name: "姜片", amount: "3-5片" },
          { name: "料酒", amount: "1汤匙" },
        ],
        duration: 300,
      },
      {
        description: `所有食材放入锅中，加足量清水（一次加够，中途不加水）。大火烧开后撇去浮沫，转小火慢炖。`,
        ingredients: [
          { name: "清水", amount: "适量" },
          { name: "枸杞/红枣", amount: "少许", substitute: "可省略" },
        ],
        duration: 5400,
      },
      {
        description: `出锅前 10 分钟加盐调味，不宜过早放盐影响食材鲜味。盛入碗中，撒上葱花或香菜。`,
        ingredients: [
          { name: "盐", amount: "适量" },
          { name: "葱花", amount: "适量" },
        ],
        duration: 60,
      },
    ],
  };
}

function getColdDishDefault(query: string): GeneratedRecipe {
  return {
    title: query,
    summary: `爽口开胃的${query}，简单快手`,
    source_links: [],
    steps: [
      {
        description: `主要食材洗净处理。需要焯水的蔬菜入沸水烫至断生（保持脆度），捞出过冰水锁住颜色和口感，沥干。`,
        ingredients: [
          { name: "主料", amount: "适量" },
        ],
        duration: 300,
      },
      {
        description: `调制酱汁：根据口味混合调味料搅匀。可提前冷藏让味道融合。`,
        ingredients: [
          { name: "蒜末", amount: "3瓣" },
          { name: "生抽", amount: "2汤匙" },
          { name: "香醋", amount: "1汤匙" },
          { name: "香油", amount: "1茶匙" },
          { name: "辣椒油", amount: "适量", substitute: "不吃辣可省略" },
        ],
        duration: 120,
      },
      {
        description: `将处理好的食材放入大碗，淋上调好的酱汁，充分拌匀。装盘撒上白芝麻和香菜点缀。`,
        ingredients: [
          { name: "白芝麻", amount: "少许" },
          { name: "香菜", amount: "适量" },
        ],
        duration: 60,
      },
    ],
  };
}

function getDessertDefault(query: string): GeneratedRecipe {
  return {
    title: query,
    summary: `甜蜜诱人的${query}，治愈你的味蕾`,
    source_links: [],
    steps: [
      {
        description: `准备所有原料。需要加热的牛奶/椰奶先小火加温但不要煮沸。吉利丁片需提前冷水泡软。`,
        ingredients: [
          { name: "主要原料", amount: "适量" },
          { name: "细砂糖", amount: "适量" },
          { name: "牛奶/椰奶", amount: "适量" },
        ],
        duration: 300,
      },
      {
        description: `按照${query}的做法混合调配。搅拌均匀确保无颗粒，过筛一次让口感更细腻。`,
        ingredients: [],
        duration: 300,
      },
      {
        description: `倒入容器，盖上保鲜膜（贴面封盖防起皮），放入冰箱冷藏至少 3-4 小时至凝固。`,
        ingredients: [],
        duration: 14400,
      },
      {
        description: `取出后根据喜好装饰水果、薄荷叶或淋上酱汁即可食用。`,
        ingredients: [
          { name: "水果/装饰", amount: "适量" },
        ],
        duration: 120,
      },
    ],
  };
}

function getNoodleDefault(query: string): GeneratedRecipe {
  return {
    title: query,
    summary: `劲道爽滑的${query}，一碗满足`,
    source_links: [],
    steps: [
      {
        description: `准备辅料。蔬菜洗净切好，肉类切片/末备用。如有需要提前炒制臊子或酱料。`,
        ingredients: [
          { name: "主料", amount: "适量" },
          { name: "蔬菜配料", amount: "适量" },
          { name: "葱姜蒜", amount: "适量" },
        ],
        duration: 300,
      },
      {
        description: `烧大量水至沸腾，下入面条/粉。保持大火，根据粗细煮 2-8 分钟至合适硬度。中途可加一次凉水防溢锅。`,
        ingredients: [
          { name: "面条/粉", amount: "200g" },
        ],
        duration: 480,
      },
      {
        description: `面条捞入碗中（拌面则充分沥干），浇上汤头或拌上酱料，放上配菜和臊子，撒葱花香菜。`,
        ingredients: [
          { name: "调味酱料", amount: "适量" },
          { name: "葱花", amount: "适量" },
        ],
        duration: 120,
      },
    ],
  };
}

function getCookingDefault(query: string): GeneratedRecipe {
  return {
    title: query,
    summary: `美味可口的${query}，家常风味`,
    source_links: [],
    steps: [
      {
        description: `准备主要食材，清洗处理后按菜品要求切配。将${query}所需的调味料提前量好备用。`,
        ingredients: [
          { name: "主料", amount: "适量" },
          { name: "葱姜蒜", amount: "适量" },
        ],
        duration: 300,
      },
      {
        description:
          "起锅热油，根据菜品特性选择合适的油温和烹饪方式。先下不易熟的食材，中火烹制至断生。",
        ingredients: [
          { name: "食用油", amount: "2汤匙" },
        ],
        duration: 300,
      },
      {
        description:
          "加入调味料和辅料，翻炒/烹制使味道均匀渗透。根据口味适当调整咸淡和辛辣程度。",
        ingredients: [
          { name: "生抽", amount: "1汤匙" },
          { name: "盐", amount: "适量" },
        ],
        duration: 180,
      },
      {
        description:
          "最终调味收汁/出锅装盘。可根据个人喜好撒上葱花或芝麻点缀。",
        ingredients: [
          { name: "葱花", amount: "装饰用" },
        ],
        duration: 120,
      },
    ],
  };
}

export function isRecipeQuery(_query: string): boolean {
  return true;
}

export async function applyAdjustment(
  recipeTitle: string,
  steps: RawStep[],
  instruction: string
): Promise<{ steps: RawStep[]; summary_suffix: string }> {
  console.log(`[Adjust] Adjusting "${recipeTitle}" with: "${instruction}"`);

  if (isLLMConfigured()) {
    console.log("[Adjust] Using LLM for adjustment");
    const currentRecipe: LLMRecipeResult = {
      title: recipeTitle,
      summary: "",
      steps: steps.map((s) => ({
        description: s.description,
        ingredients: s.ingredients,
        duration: s.duration,
      })),
    };
    const adjusted = await adjustRecipeWithLLM(currentRecipe, instruction);
    if (adjusted) {
      return {
        steps: adjusted.steps.map((s) => ({
          description: s.description,
          ingredients: s.ingredients || [],
          duration: s.duration || 120,
        })),
        summary_suffix: `（已根据「${instruction}」由 AI 调整）`,
      };
    }
  }

  return {
    steps: applyLocalAdjustment(steps, instruction),
    summary_suffix: `（已根据「${instruction}」调整）`,
  };
}

function applyLocalAdjustment(steps: RawStep[], instruction: string): RawStep[] {
  const lower = instruction.toLowerCase();

  return steps.map((step) => {
    const adjusted = { ...step, ingredients: [...step.ingredients] };

    if (/少糖|减糖|低糖|无糖/.test(lower)) {
      adjusted.ingredients = adjusted.ingredients.map((ing) => {
        if (/糖|冰糖|砂糖|糖浆|蜂蜜/.test(ing.name)) {
          return { ...ing, amount: "减半", substitute: "代糖或少量蜂蜜" };
        }
        return ing;
      });
    }

    if (/少盐|减盐|低盐|清淡/.test(lower)) {
      adjusted.ingredients = adjusted.ingredients.map((ing) => {
        if (/盐|酱油|生抽|老抽|豉油|蚝油/.test(ing.name)) {
          return { ...ing, amount: "减半" };
        }
        return ing;
      });
    }

    if (/少油|减油|低脂|低卡/.test(lower)) {
      adjusted.ingredients = adjusted.ingredients.map((ing) => {
        if (/油|黄油/.test(ing.name)) {
          return { ...ing, amount: "减半", substitute: "空气炸锅可进一步减油" };
        }
        return ing;
      });
    }

    if (/不吃辣|去辣|不要辣|微辣|减辣/.test(lower)) {
      adjusted.ingredients = adjusted.ingredients.filter(
        (ing) => !/辣|花椒|豆瓣/.test(ing.name)
      );
    }

    return adjusted;
  });
}
