/* ------------------------------------------------------------------ */
/*  PyWots — curriculum + game math                                     */
/*                                                                     */
/*  A 60-day path from zero to competent Python, framed as a Solo-      */
/*  Leveling-style ascent: a daily Gate, stats that grow, Hunter ranks. */
/*                                                                     */
/*  Days 1-10 are fully authored (teaching cards + guided lessons +     */
/*  a real code Dungeon graded by Pyodide). Days 11-60 are mapped to    */
/*  concrete topics in TOPIC_MAP and stay playable via PRACTICE — a     */
/*  bank of real graded problems per stat — until each day is written.  */
/* ------------------------------------------------------------------ */

export const PROGRAM_DAYS = 100;

/* The six stats. Everything you do feeds one of them. */
export const STATS = [
  { id: "SYN",  label: "Syntax",    blurb: "The language itself — how Python wants you to speak." },
  { id: "FLOW", label: "Control",   blurb: "Decisions and repetition. Making code choose and loop." },
  { id: "DATA", label: "Data",      blurb: "Lists, dicts, sets, strings — holding many things at once." },
  { id: "FUNC", label: "Functions", blurb: "Naming a block of work so you can reuse and trust it." },
  { id: "OOP",  label: "Objects",   blurb: "Building your own types with classes." },
  { id: "CRAFT",label: "Craft",     blurb: "Errors, files, modules, tooling — shipping real programs." },
];

/* ---------------------------- ranks ------------------------------ */
/* Hunter Rank is earned by clearing Gates (boss days), not by XP.
   11 Gates across the 100 days -> index 0 (E, no Gates) through 11 (Monarch). */
export const RANKS = [
  "E", "D", "C", "B", "A", "S", "S+", "SS", "SS+", "SSS", "National", "Monarch",
];

/* boss day -> the rank index you hold after clearing it */
export const BOSS_DAYS = {
  7: 1, 10: 2, 20: 3, 30: 4, 40: 5, 50: 6, 60: 7, 70: 8, 80: 9, 90: 10, 100: 11,
};

export const isBossDay = (day) => Object.prototype.hasOwnProperty.call(BOSS_DAYS, day);

export function rankFromBosses(bossesCleared) {
  return RANKS[Math.min(bossesCleared, RANKS.length - 1)];
}

/* ------------------------- level / xp --------------------------- */
/* Level is pure flavour progress. Curve ramps gently.               */
export function xpForLevel(level) {
  // xp needed to go from `level` to `level + 1`
  return 80 + (level - 1) * 35;
}

export function levelFromXP(totalXP) {
  let level = 1;
  let need = xpForLevel(1);
  let acc = 0;
  while (totalXP >= acc + need) {
    acc += need;
    level += 1;
    need = xpForLevel(level);
  }
  return { level, into: totalXP - acc, need };
}

/* --------------------------- assessment ------------------------- */
/* The Awakening Test. Sets your starting stats and difficulty.      */
export const ASSESSMENT = [
  { id: "exp",  stat: "SYN",  q: "How much have you coded before?",
    options: ["Never written a line", "Other languages, not Python", "A little Python", "Lots of Python"] },
  { id: "flow", stat: "FLOW", q: "Loops and if / else — where are you?",
    options: ["No idea what those are", "I've seen them", "I can write them", "Second nature"] },
  { id: "data", stat: "DATA", q: "Lists and dictionaries?",
    options: ["What are those", "Vaguely familiar", "I use them fine", "Comprehensions in my sleep"] },
  { id: "func", stat: "FUNC", q: "Writing your own functions?",
    options: ["Never have", "Copied a few", "Yes, regularly", "Closures, decorators, the lot"] },
  { id: "oop",  stat: "OOP",  q: "Classes and objects?",
    options: ["Never touched them", "Heard the word", "I can write a class", "I design hierarchies"] },
];

export const BASE_POINTS = [2, 10, 22, 40];

/* Build the starting stat block from assessment answers (index 0-3 each). */
export function startingStats(answers) {
  const out = {};
  const bases = [];
  for (const item of ASSESSMENT) {
    const a = answers[item.id] ?? 0;
    const pts = BASE_POINTS[a];
    out[item.stat] = pts;
    bases.push(pts);
  }
  // CRAFT isn't asked directly — seed it from your weakest answered area.
  out.CRAFT = Math.max(2, Math.min(...bases));
  for (const s of STATS) if (out[s.id] == null) out[s.id] = 2;
  return out;
}

/* =================================================================== */
/*  AUTHORED DAYS 1-10                                                  */
/* =================================================================== */
/*
  Day shape:
  {
    day, title, stat,            // stat = primary stat this day trains
    system,                      // the System's message for the day
    boss: bool,
    concepts: [ "teaching card text", ... ],
    lessons: [ lesson, ... ],    // guided, graded client-side
    dungeon: {
      brief, starter, stat, xp,
      tests: [ { label, code } ]   // python; may reference user names + STDOUT
    }
  }

  Lesson kinds:
  - { kind:"mcq",     prompt, code?, options:[...], answer:idx, explain }
  - { kind:"predict", prompt, code,  options:[...], answer:idx, explain }   // like mcq, always has code
  - { kind:"blank",   prompt, code (uses U+25A2 box as the slot),
      choices:[...], answer:idx, explain }
  - { kind:"order",   prompt, lines:[...correct order], explain }
*/

const SLOT = "▢"; // ▢  placeholder rendered as the fill-in slot

export const DAYS = [
  /* ---------------------------- Day 1 ---------------------------- */
  {
    day: 1,
    title: "Awakening — the print skill",
    stat: "SYN",
    system: "You have been chosen. The System grants you your first skill: OUTPUT. Speak, and the console listens.",
    boss: false,
    concepts: [
      "print(...) sends text to the console — the System's output window. Whatever you put in the parentheses gets shown.",
      "Text is a string: characters wrapped in quotes, 'single' or \"double\". Both work; just match them.",
      "A line starting with # is a comment. Python ignores it. It's a note to humans.",
      "Each print(...) call puts its text on its own line.",
    ],
    lessons: [
      {
        kind: "mcq",
        prompt: "Which line shows  Hello, Hunter  in the console?",
        options: [
          'print("Hello, Hunter")',
          'console.log("Hello, Hunter")',
          'echo "Hello, Hunter"',
          'print(Hello, Hunter)',
        ],
        answer: 0,
        explain: "Python uses print(). The text must be quoted — without quotes, Python thinks Hello and Hunter are names it should look up.",
      },
      {
        kind: "predict",
        prompt: "What appears in the console?",
        code: 'print("Arise")\nprint("Shadow")',
        options: [
          "Arise\nShadow  (two lines)",
          "Arise Shadow  (one line)",
          "AriseShadow",
          "Nothing — this is an error",
        ],
        answer: 0,
        explain: "Two print calls means two lines. Each call ends its line for you.",
      },
      {
        kind: "blank",
        prompt: "Fill the blank so the console shows  Level 1 cleared",
        code: `${SLOT}("Level 1 cleared")`,
        choices: ["print", "say", "write", "show"],
        answer: 0,
        explain: "print is the built-in. The others aren't Python.",
      },
    ],
    dungeon: {
      brief:
        "Announce your awakening. Print exactly two lines:\n" +
        "  I have been chosen.\n" +
        "  The System is online.\n" +
        "Match the text exactly, including the full stops.",
      starter: "# Two print statements. That's the whole quest.\n",
      stat: "SYN",
      xp: 35,
      tests: [
        { label: "prints two lines", code: "assert len(STDOUT.strip().splitlines()) == 2, 'expected exactly 2 lines'" },
        { label: "line 1 is correct", code: "assert STDOUT.strip().splitlines()[0] == 'I have been chosen.'" },
        { label: "line 2 is correct", code: "assert STDOUT.strip().splitlines()[1] == 'The System is online.'" },
      ],
    },
  },

  /* ---------------------------- Day 2 ---------------------------- */
  {
    day: 2,
    title: "Variables & types",
    stat: "SYN",
    system: "Skill acquired: STORAGE. Give a value a name and it waits for you.",
    boss: false,
    concepts: [
      "A variable is a name bound to a value:  hp = 100  reads 'let hp be 100'. The = is assignment, not equality.",
      "Every value has a type. Whole numbers are int, decimals are float, text is str, and True / False are bool.",
      "type(value) tells you the type. type(100) is <class 'int'>, type('x') is <class 'str'>.",
      "Reassigning is fine and common:  hp = hp - 10  makes hp 90.",
    ],
    lessons: [
      {
        kind: "mcq",
        prompt: "After  hp = 100  what is the type of hp?",
        options: ["int", "str", "float", "bool"],
        answer: 0,
        explain: "100 has no decimal point and no quotes, so it's an int.",
      },
      {
        kind: "predict",
        prompt: "What prints?",
        code: 'x = 3\ny = "3"\nprint(x, y)',
        options: ["3 3", "6", "33", "Error — can't mix them"],
        answer: 0,
        explain: "print shows both, separated by a space. One is the number 3, one is the text '3' — they look the same when printed.",
      },
      {
        kind: "blank",
        prompt: "Make  level  a float equal to seven.",
        code: `level = ${SLOT}`,
        choices: ["7", "7.0", '"7"', "seven"],
        answer: 1,
        explain: "7.0 has a decimal point, so it's a float. 7 is an int, \"7\" is a string, and seven is an undefined name.",
      },
    ],
    dungeon: {
      brief:
        "Set up your hunter record. Create three variables:\n" +
        "  name  — your hunter name, a string\n" +
        "  level — the int 1\n" +
        "  mana  — the float 10.0\n" +
        "Then print each on its own line.",
      starter: "name = \nlevel = \nmana = \n",
      stat: "SYN",
      xp: 35,
      tests: [
        { label: "name is a non-empty string", code: "assert isinstance(name, str) and len(name) > 0" },
        { label: "level is the int 1", code: "assert level == 1 and isinstance(level, int)" },
        { label: "mana is the float 10.0", code: "assert mana == 10.0 and isinstance(mana, float)" },
        { label: "printed three lines", code: "assert len(STDOUT.strip().splitlines()) == 3" },
      ],
    },
  },

  /* ---------------------------- Day 3 ---------------------------- */
  {
    day: 3,
    title: "Operators & f-strings",
    stat: "SYN",
    system: "Skill acquired: CALCULATION. Numbers bend. Text takes shape.",
    boss: false,
    concepts: [
      "Arithmetic:  +  -  *  /  . Note / always gives a float:  6 / 2  is  3.0 .",
      "//  is floor division (drop the remainder):  7 // 2  is  3 .  %  is the remainder:  7 % 2  is  1 .",
      "**  is power:  2 ** 3  is  8 .",
      "An f-string drops values into text:  f\"HP: {hp}\" . The part in {curly braces} is evaluated — f\"{2+2}\" is \"4\".",
    ],
    lessons: [
      {
        kind: "predict",
        prompt: "What prints?",
        code: "print(7 // 2, 7 % 2)",
        options: ["3 1", "3.5 0", "1 3", "3 0"],
        answer: 0,
        explain: "7 // 2 is 3 (floor division). 7 % 2 is 1 (the remainder).",
      },
      {
        kind: "mcq",
        prompt: "What is  2 ** 3 ?",
        options: ["6", "8", "9", "23"],
        answer: 1,
        explain: "** is exponent: 2 to the power of 3 is 8.",
      },
      {
        kind: "blank",
        prompt: "Complete the f-string so it reads  Score: 42  when score is 42.",
        code: `msg = ${SLOT}"Score: {score}"`,
        choices: ["f", "r", "b", "(nothing)"],
        answer: 0,
        explain: "The f prefix makes {score} get replaced by its value. Without it you'd literally print the braces.",
      },
    ],
    dungeon: {
      brief:
        "a and b are already defined (a = 17, b = 5). Using f-strings, print these three lines exactly:\n" +
        "  17 + 5 = 22\n" +
        "  17 // 5 = 3\n" +
        "  17 % 5 = 2",
      starter: "a = 17\nb = 5\n# print three f-strings\n",
      stat: "SYN",
      xp: 38,
      tests: [
        { label: "sum line", code: "assert STDOUT.strip().splitlines()[0] == '17 + 5 = 22'" },
        { label: "floor-div line", code: "assert STDOUT.strip().splitlines()[1] == '17 // 5 = 3'" },
        { label: "modulo line", code: "assert STDOUT.strip().splitlines()[2] == '17 % 5 = 2'" },
      ],
    },
  },

  /* ---------------------------- Day 4 ---------------------------- */
  {
    day: 4,
    title: "Input & converting types",
    stat: "SYN",
    system: "Skill acquired: INTAKE. The world speaks in text. You decide what it means.",
    boss: false,
    concepts: [
      "input(prompt) pauses and reads a line the user types. It ALWAYS returns a str — even '42' comes back as text.",
      "Convert with int(...), float(...), str(...):  int('42')  is  42 ,  str(42)  is  '42' .",
      "int('4.5') fails — int() only parses whole-number text. Use float('4.5') for that.",
      "A common bug:  input() + 1  crashes because you can't add a number to text. Wrap it:  int(input()) + 1 .",
    ],
    lessons: [
      {
        kind: "mcq",
        prompt: "input() always returns a value of what type?",
        options: ["int", "str", "whatever the user typed", "float"],
        answer: 1,
        explain: "Always str. If you need a number you convert it yourself.",
      },
      {
        kind: "predict",
        prompt: "What prints?",
        code: 'print(int("42") + 8)',
        options: ["50", "428", "'42' + 8", "Error"],
        answer: 0,
        explain: "int('42') becomes the number 42, then 42 + 8 is 50.",
      },
      {
        kind: "blank",
        prompt: "Read a whole number from the user into  age .",
        code: `age = ${SLOT}(input("Age? "))`,
        choices: ["int", "str", "num", "float"],
        answer: 0,
        explain: "int(...) turns the text the user typed into a whole number.",
      },
    ],
    dungeon: {
      brief:
        "Write a function  to_total(raw)  that takes a string of three numbers separated by commas,\n" +
        'like "10,20,30", and returns their sum as an int.\n' +
        'to_total("10,20,30") -> 60 ,   to_total("1,2,3") -> 6',
      starter: "def to_total(raw):\n    # split on ',', convert each piece, add them up\n    pass\n",
      stat: "SYN",
      xp: 40,
      tests: [
        { label: "to_total('10,20,30') == 60", code: "assert to_total('10,20,30') == 60" },
        { label: "to_total('1,2,3') == 6", code: "assert to_total('1,2,3') == 6" },
        { label: "returns an int", code: "assert isinstance(to_total('4,4,4'), int)" },
      ],
    },
  },

  /* ---------------------------- Day 5 ---------------------------- */
  {
    day: 5,
    title: "Booleans & comparisons",
    stat: "FLOW",
    system: "Skill acquired: JUDGEMENT. Every question resolves to yes or no.",
    boss: false,
    concepts: [
      "Comparisons give a bool:  ==  (equal),  !=  (not equal),  <  >  <=  >= .  Note  ==  compares,  =  assigns.",
      "Combine with  and ,  or ,  not .  A and B  is True only if both are.  A or B  is True if either is.",
      "Truthiness: 0, '', [], {}, None are 'falsy'; almost everything else is 'truthy'.  bool('x')  is True,  bool(0)  is False.",
      "Comparisons chain:  0 <= x < 10  is valid and means what it looks like.",
    ],
    lessons: [
      {
        kind: "predict",
        prompt: "What prints?",
        code: "print(3 < 5 and 5 < 4)",
        options: ["True", "False", "3 < 5", "Error"],
        answer: 1,
        explain: "3 < 5 is True, 5 < 4 is False. True and False is False.",
      },
      {
        kind: "mcq",
        prompt: "What is  not (True or False) ?",
        options: ["True", "False", "None", "Error"],
        answer: 1,
        explain: "True or False is True. not True is False.",
      },
      {
        kind: "blank",
        prompt: "is_boss should be True when level is 10 or higher.",
        code: `is_boss = level ${SLOT} 10`,
        choices: [">=", ">", "==", "="],
        answer: 0,
        explain: ">= covers 10 and above. > would miss exactly 10, and = is assignment.",
      },
    ],
    dungeon: {
      brief:
        "Write  can_enter(level, has_key)  that returns True only when\n" +
        "level is at least 5 AND has_key is True. Otherwise return False.",
      starter: "def can_enter(level, has_key):\n    pass\n",
      stat: "FLOW",
      xp: 40,
      tests: [
        { label: "5 and key -> True", code: "assert can_enter(5, True) is True" },
        { label: "10 and no key -> False", code: "assert can_enter(10, False) is False" },
        { label: "3 and key -> False", code: "assert can_enter(3, True) is False" },
        { label: "returns a bool", code: "assert isinstance(can_enter(9, True), bool)" },
      ],
    },
  },

  /* ---------------------------- Day 6 ---------------------------- */
  {
    day: 6,
    title: "if / elif / else",
    stat: "FLOW",
    system: "Skill acquired: BRANCHING. The path forks. Your code chooses.",
    boss: false,
    concepts: [
      "if condition:  runs its indented block only when the condition is truthy.",
      "elif condition:  is checked only if every branch above it was False.  else:  runs if nothing matched.",
      "Indentation is the block. Four spaces, consistently. Python uses whitespace where other languages use { }.",
      "Order matters: put the most specific / highest threshold first, since the first match wins.",
    ],
    lessons: [
      {
        kind: "mcq",
        prompt: 'Which keyword means "otherwise, if this other thing"?',
        options: ["elseif", "else if", "elif", "elsif"],
        answer: 2,
        explain: "Python spells it elif.",
      },
      {
        kind: "predict",
        prompt: "What prints?",
        code: "x = 7\nif x > 10:\n    print('big')\nelif x > 5:\n    print('mid')\nelse:\n    print('small')",
        options: ["big", "mid", "small", "mid\nsmall"],
        answer: 1,
        explain: "x > 10 is False, x > 5 is True, so 'mid' prints and the else is skipped.",
      },
      {
        kind: "order",
        prompt: "Put these lines in order to print S / A / F by score (score is already set).",
        lines: [
          "if score >= 90:",
          "    print('S')",
          "elif score >= 50:",
          "    print('A')",
          "else:",
          "    print('F')",
        ],
        explain: "The if goes first, then its body, then elif with its body, then else with its body. Highest threshold first.",
      },
    ],
    dungeon: {
      brief:
        "Write  rank(score)  that returns a letter:\n" +
        "  'S' if score >= 90\n  'A' if score >= 75\n  'B' if score >= 50\n  otherwise 'E'",
      starter: "def rank(score):\n    pass\n",
      stat: "FLOW",
      xp: 42,
      tests: [
        { label: "95 -> 'S'", code: "assert rank(95) == 'S'" },
        { label: "75 -> 'A'", code: "assert rank(75) == 'A'" },
        { label: "60 -> 'B'", code: "assert rank(60) == 'B'" },
        { label: "20 -> 'E'", code: "assert rank(20) == 'E'" },
      ],
    },
  },

  /* ---------------------------- Day 7 : GATE ---------------------------- */
  {
    day: 7,
    title: "E-Rank Gate",
    stat: "FLOW",
    system:
      "A Gate has formed. Clear it and the Association upgrades your licence to D-Rank. " +
      "Everything from your first week is fair game.",
    boss: true,
    concepts: [
      "Recap: variables hold values, f-strings build text, comparisons give bools, if / elif / else choose a path.",
      "A function can call another function you wrote. Build small pieces, then combine them.",
    ],
    lessons: [
      {
        kind: "mcq",
        prompt: "Which builds the text  Jin — Lv.4  when name='Jin' and level=4?",
        options: [
          'f"{name} — Lv.{level}"',
          '"{name} — Lv.{level}"',
          'f"name — Lv.level"',
          '{name} + " — Lv." + {level}',
        ],
        answer: 0,
        explain: "The f prefix plus {name} and {level} in braces. Without f the braces are literal.",
      },
      {
        kind: "predict",
        prompt: "score is 82. What does this return?",
        code: "if score >= 90:\n    r = 'S'\nelif score >= 75:\n    r = 'A'\nelse:\n    r = 'B'",
        options: ["'S'", "'A'", "'B'", "nothing"],
        answer: 1,
        explain: "82 fails >= 90 but passes >= 75, so r becomes 'A'.",
      },
    ],
    dungeon: {
      brief:
        "The Gate has three chambers. Write three functions:\n\n" +
        "1. profile(name, level)  -> the string  f\"{name} — Lv.{level}\"\n" +
        "2. grade(score)  -> 'S' (>=90), 'A' (>=75), 'B' (>=50), else 'E'\n" +
        "3. report(name, level, score)  -> f\"{profile(...)} [{grade(...)}]\"\n" +
        "   e.g. report('Jin', 4, 88)  ->  'Jin — Lv.4 [A]'",
      starter:
        "def profile(name, level):\n    pass\n\n" +
        "def grade(score):\n    pass\n\n" +
        "def report(name, level, score):\n    pass\n",
      stat: "FLOW",
      xp: 70,
      tests: [
        { label: "profile builds the card", code: "assert profile('Jin', 4) == 'Jin — Lv.4'" },
        { label: "grade(88) == 'A'", code: "assert grade(88) == 'A'" },
        { label: "grade(50) == 'B'", code: "assert grade(50) == 'B'" },
        { label: "grade(10) == 'E'", code: "assert grade(10) == 'E'" },
        { label: "report combines both", code: "assert report('Jin', 4, 88) == 'Jin — Lv.4 [A]'" },
        { label: "report handles an S", code: "assert report('Aria', 12, 99) == 'Aria — Lv.12 [S]'" },
      ],
    },
  },

  /* ---------------------------- Day 8 ---------------------------- */
  {
    day: 8,
    title: "while loops",
    stat: "FLOW",
    system: "Skill acquired: REPETITION. Say it once, run it until the condition breaks.",
    boss: false,
    concepts: [
      "while condition:  repeats its block as long as the condition stays truthy.",
      "Something inside the loop must move toward making the condition False — usually updating a counter — or it never ends.",
      "break  leaves the loop immediately.  continue  skips to the next iteration.",
      "A classic shape:  i = 0  /  while i < n:  ... ;  i += 1  .  i += 1  is short for  i = i + 1 .",
    ],
    lessons: [
      {
        kind: "predict",
        prompt: "What prints?",
        code: "i = 0\nwhile i < 3:\n    print(i)\n    i += 1",
        options: ["0\n1\n2", "1\n2\n3", "0\n1\n2\n3", "runs forever"],
        answer: 0,
        explain: "Starts at 0, prints while i < 3, stops once i reaches 3. So 0, 1, 2.",
      },
      {
        kind: "mcq",
        prompt: "What causes an accidental infinite loop?",
        options: [
          "Using while instead of for",
          "The condition never becomes False",
          "Printing inside the loop",
          "Starting the counter at 0",
        ],
        answer: 1,
        explain: "If nothing in the body moves the condition toward False, it loops forever.",
      },
      {
        kind: "blank",
        prompt: "Count down while count is still above zero.",
        code: `while count ${SLOT} 0:\n    print(count)\n    count -= 1`,
        choices: [">", ">=", "<", "!="],
        answer: 0,
        explain: "> 0 stops at 0. >= 0 would print 0 then try -1... actually it stops eventually but prints 0; > 0 is the clean countdown.",
      },
    ],
    dungeon: {
      brief:
        "Write  countdown(n)  that returns a list:  [n, n-1, ..., 1, 'Go!'] .\n" +
        "countdown(3)  ->  [3, 2, 1, 'Go!'] .  Use a while loop.",
      starter: "def countdown(n):\n    result = []\n    # while loop here\n    return result\n",
      stat: "FLOW",
      xp: 42,
      tests: [
        { label: "countdown(3)", code: "assert countdown(3) == [3, 2, 1, 'Go!']" },
        { label: "countdown(1)", code: "assert countdown(1) == [1, 'Go!']" },
        { label: "countdown(5) length", code: "assert len(countdown(5)) == 6" },
      ],
    },
  },

  /* ---------------------------- Day 9 ---------------------------- */
  {
    day: 9,
    title: "for loops & range",
    stat: "FLOW",
    system: "Skill upgraded: REPETITION II. Walk a sequence step by step without a manual counter.",
    boss: false,
    concepts: [
      "for item in sequence:  runs the block once per item, binding item each time. Works on lists, strings, ranges.",
      "range(stop) is 0..stop-1. range(start, stop) is start..stop-1. range(start, stop, step) skips by step.",
      "for i in range(5):  gives i = 0,1,2,3,4 — five iterations.",
      "Accumulate by starting a variable before the loop and updating it inside:  total = 0  /  for n in nums: total += n .",
    ],
    lessons: [
      {
        kind: "predict",
        prompt: "What prints?",
        code: "for i in range(1, 4):\n    print(i)",
        options: ["1\n2\n3", "0\n1\n2\n3", "1\n2\n3\n4", "1\n4"],
        answer: 0,
        explain: "range(1, 4) is 1, 2, 3 — the stop value 4 is not included.",
      },
      {
        kind: "mcq",
        prompt: "Which values does  range(0, 10, 2)  produce?",
        options: ["0..10", "0 2 4 6 8", "2 4 6 8 10", "0 2 4 6 8 10"],
        answer: 1,
        explain: "Start 0, step 2, stop before 10: 0, 2, 4, 6, 8.",
      },
      {
        kind: "blank",
        prompt: "Loop over each character of the string  word .",
        code: `for c in ${SLOT}:\n    print(c)`,
        choices: ["word", "range(word)", "len(word)", "word()"],
        answer: 0,
        explain: "Iterating a string directly yields its characters one at a time.",
      },
    ],
    dungeon: {
      brief:
        "Write  times_table(n)  that returns a list of strings:\n" +
        '  ["n x 1 = n", "n x 2 = ...", ... up to "n x 10 = ..."]\n' +
        "times_table(2)[0]  ->  '2 x 1 = 2' ,   times_table(2)[9]  ->  '2 x 10 = 20'",
      starter: "def times_table(n):\n    rows = []\n    for i in range(1, 11):\n        pass\n    return rows\n",
      stat: "FLOW",
      xp: 44,
      tests: [
        { label: "ten rows", code: "assert len(times_table(2)) == 10" },
        { label: "first row", code: "assert times_table(2)[0] == '2 x 1 = 2'" },
        { label: "last row", code: "assert times_table(2)[9] == '2 x 10 = 20'" },
        { label: "works for 7", code: "assert times_table(7)[3] == '7 x 4 = 28'" },
      ],
    },
  },

  /* ---------------------------- Day 10 : BOSS ---------------------------- */
  {
    day: 10,
    title: "D-Rank Gate — Loops Within Loops",
    stat: "FLOW",
    system:
      "A red Gate. Dungeon-break risk. The Association needs it cleared today. Succeed and you rise to C-Rank.",
    boss: true,
    concepts: [
      "Recap: while for repeat-until, for for walking a sequence, range for counting, accumulators for building a result.",
      "Nested loops: a loop inside a loop. The inner one runs fully for every step of the outer one.",
      "A number is prime if no integer from 2 up to n-1 divides it evenly (n % d == 0).",
    ],
    lessons: [
      {
        kind: "predict",
        prompt: "How many times does  print  run?",
        code: "for a in range(3):\n    for b in range(2):\n        print(a, b)",
        options: ["3", "2", "5", "6"],
        answer: 3,
        explain: "The inner loop (2 iterations) runs fully for each of the 3 outer iterations: 3 x 2 = 6.",
      },
      {
        kind: "mcq",
        prompt: "Which test says 'd divides n with nothing left over'?",
        options: ["n / d == 0", "n % d == 0", "n // d == 0", "d % n == 0"],
        answer: 1,
        explain: "% is the remainder. A remainder of 0 means d divides n exactly.",
      },
    ],
    dungeon: {
      brief:
        "Three chambers. Write:\n\n" +
        "1. fizzbuzz(n) -> a list length n. For 1..n: multiples of 15 -> 'FizzBuzz',\n" +
        "   multiples of 3 -> 'Fizz', multiples of 5 -> 'Buzz', else the number itself (as an int).\n" +
        "   fizzbuzz(5) -> [1, 2, 'Fizz', 4, 'Buzz']\n\n" +
        "2. stairs(rows) -> a single string, a left-aligned triangle of '#',\n" +
        "   rows lines joined by '\\n'.  stairs(3) -> '#\\n##\\n###'\n\n" +
        "3. next_prime(n) -> the smallest prime strictly greater than n.\n" +
        "   next_prime(13) -> 17 ,  next_prime(1) -> 2",
      starter:
        "def fizzbuzz(n):\n    pass\n\n" +
        "def stairs(rows):\n    pass\n\n" +
        "def is_prime(x):\n    if x < 2:\n        return False\n    for d in range(2, x):\n        if x % d == 0:\n            return False\n    return True\n\n" +
        "def next_prime(n):\n    pass\n",
      stat: "FLOW",
      xp: 90,
      tests: [
        { label: "fizzbuzz(5)", code: "assert fizzbuzz(5) == [1, 2, 'Fizz', 4, 'Buzz']" },
        { label: "fizzbuzz(15) ends FizzBuzz", code: "assert fizzbuzz(15)[14] == 'FizzBuzz'" },
        { label: "stairs(3)", code: "assert stairs(3) == '#\\n##\\n###'" },
        { label: "stairs(1)", code: "assert stairs(1) == '#'" },
        { label: "next_prime(13) == 17", code: "assert next_prime(13) == 17" },
        { label: "next_prime(1) == 2", code: "assert next_prime(1) == 2" },
        { label: "next_prime(20) == 23", code: "assert next_prime(20) == 23" },
      ],
    },
  },
];

/* =================================================================== */
/*  TOPIC MAP — days 11-60 (scouted, not yet fully authored)           */
/* =================================================================== */
export const TOPIC_MAP = [
  { day: 11, stat: "DATA", title: "Lists: index & slice",           objective: "Build lists, read by index (incl. negative), take slices a[1:4]." },
  { day: 12, stat: "DATA", title: "List methods",                    objective: "append, insert, pop, remove, sort, reverse, len, in." },
  { day: 13, stat: "DATA", title: "List comprehensions",             objective: "[expr for x in xs if cond] — transform and filter in one line." },
  { day: 14, stat: "DATA", title: "Tuples & unpacking",              objective: "Immutable sequences; a, b = pair; swap without a temp." },
  { day: 15, stat: "DATA", title: "Strings, deep",                   objective: "split, join, strip, replace, find, slicing, f-string format specs." },
  { day: 16, stat: "DATA", title: "Dictionaries",                    objective: "Key/value stores; d[k], d.get, add, update, delete, 'in'." },
  { day: 17, stat: "DATA", title: "Iterating dicts & nesting",       objective: ".items(), .keys(), .values(); dicts of lists / dicts." },
  { day: 18, stat: "DATA", title: "Sets",                            objective: "Uniqueness, membership, union | intersection & difference -." },
  { day: 19, stat: "DATA", title: "Data structures — practice mix",  objective: "Pick the right container; combine list + dict to model data." },
  { day: 20, stat: "DATA", title: "C-Rank Gate — Data Wrangling",    objective: "BOSS: parse messy input into clean structures and summarise it." },

  { day: 21, stat: "FUNC", title: "Defining functions",             objective: "def, parameters, return; return vs print; None by default." },
  { day: 22, stat: "FUNC", title: "Default & keyword arguments",    objective: "def f(x, step=1); call by name; argument order rules." },
  { day: 23, stat: "FUNC", title: "*args and **kwargs",             objective: "Variadic positional and keyword arguments; forwarding them." },
  { day: 24, stat: "FUNC", title: "Scope & closures",               objective: "Local vs global, the LEGB rule, functions that return functions." },
  { day: 25, stat: "FUNC", title: "Lambdas, map, filter",           objective: "Anonymous functions; when a comprehension is clearer." },
  { day: 26, stat: "FUNC", title: "Recursion",                       objective: "Base case + recursive case; factorial, sum, countdown." },
  { day: 27, stat: "FUNC", title: "Docstrings & type hints",        objective: "\"\"\"...\"\"\", def f(x: int) -> str; readable, self-documenting code." },
  { day: 28, stat: "FUNC", title: "Higher-order functions",         objective: "Passing functions as arguments; sorted(key=...)." },
  { day: 29, stat: "FUNC", title: "Functions — practice mix",       objective: "Compose small functions into a working tool." },
  { day: 30, stat: "FUNC", title: "B-Rank Gate — The Toolkit",      objective: "BOSS: build a set of well-typed functions that work together." },

  { day: 31, stat: "CRAFT", title: "Errors & exceptions",           objective: "try / except / else / finally; catching specific exception types." },
  { day: 32, stat: "CRAFT", title: "Raising & custom exceptions",   objective: "raise ValueError(...); class MyError(Exception)." },
  { day: 33, stat: "CRAFT", title: "Reading tracebacks & debugging",objective: "Read a stack trace bottom-up; isolate with prints / asserts." },
  { day: 34, stat: "CRAFT", title: "Modules & imports",             objective: "import, from x import y, if __name__ == '__main__', your own modules." },
  { day: 35, stat: "CRAFT", title: "Standard library tour",         objective: "math, random, datetime, statistics — batteries included." },
  { day: 36, stat: "CRAFT", title: "collections & itertools",       objective: "Counter, defaultdict, deque; count, cycle, chain, groupby." },
  { day: 37, stat: "CRAFT", title: "Files: read & write text",      objective: "with open(path) as f; read, readlines, write; paths." },
  { day: 38, stat: "CRAFT", title: "JSON & CSV",                     objective: "json.loads / dumps; csv.reader / DictReader; round-tripping data." },
  { day: 39, stat: "CRAFT", title: "Craft — practice mix",          objective: "Load a file, transform it, handle the errors, write it back." },
  { day: 40, stat: "CRAFT", title: "A-Rank Gate — The CLI",         objective: "BOSS: a small command-line program that reads input and reports." },

  { day: 41, stat: "OOP", title: "Classes & __init__",              objective: "class, instances, self, instance attributes." },
  { day: 42, stat: "OOP", title: "Methods & class attributes",      objective: "Behaviour on the class; instance vs class attribute lookup." },
  { day: 43, stat: "OOP", title: "Dunder methods",                   objective: "__str__, __repr__, __eq__, __len__ — hooking into the language." },
  { day: 44, stat: "OOP", title: "Inheritance & super()",           objective: "Subclassing, overriding, calling the parent implementation." },
  { day: 45, stat: "OOP", title: "Encapsulation & properties",      objective: "_private convention, @property, computed / validated attributes." },
  { day: 46, stat: "OOP", title: "Composition & polymorphism",      objective: "Has-a vs is-a; duck typing; programming to an interface." },
  { day: 47, stat: "OOP", title: "Dataclasses",                      objective: "@dataclass for boilerplate-free records; defaults, ordering." },
  { day: 48, stat: "OOP", title: "OOP — practice mix",               objective: "Model a small domain with 2-3 cooperating classes." },
  { day: 49, stat: "OOP", title: "Designing a hierarchy",           objective: "Choose the base class, factor shared behaviour, avoid deep trees." },
  { day: 50, stat: "OOP", title: "S-Rank Gate — Model a System",    objective: "BOSS: design and implement a class-based model of a real system." },

  { day: 51, stat: "FUNC",  title: "Iterators & generators",        objective: "__iter__ / __next__; yield; lazy sequences, generator expressions." },
  { day: 52, stat: "FUNC",  title: "Decorators",                     objective: "Wrapping functions; @wraps; timing / caching / logging decorators." },
  { day: 53, stat: "CRAFT", title: "Context managers",              objective: "The with protocol; __enter__ / __exit__; contextlib.contextmanager." },
  { day: 54, stat: "DATA",  title: "Comprehension mastery",         objective: "Dict & set comprehensions, nested comprehensions, when NOT to." },
  { day: 55, stat: "FLOW",  title: "Search & sort thinking",        objective: "Linear vs binary search; what sorted() costs; stable sorts." },
  { day: 56, stat: "FLOW",  title: "Complexity intuition",          objective: "O(1) / O(n) / O(n^2) by feel; spotting accidental quadratics." },
  { day: 57, stat: "CRAFT", title: "Testing your code",             objective: "assert-based tests, unittest basics, arrange-act-assert." },
  { day: 58, stat: "CRAFT", title: "Environments & packaging",      objective: "venv, pip, requirements.txt, project layout — concepts + commands." },
  { day: 59, stat: "CRAFT", title: "Capstone prep",                 objective: "Spec a program: inputs, outputs, data model, failure modes." },
  { day: 60, stat: "CRAFT", title: "SS-Rank Gate — The Craftsman's Trial", objective: "BOSS: build a complete, tested, multi-function program from a spec." },

  /* ---- Phase 7 · Applied Python (61-70) ---- */
  { day: 61, stat: "CRAFT", title: "Dates & time, properly",        objective: "datetime, date, timedelta, parsing/formatting, zoneinfo & UTC." },
  { day: 62, stat: "DATA",  title: "Regular expressions",           objective: "re: match/search/findall/sub, groups, character classes, anchors." },
  { day: 63, stat: "DATA",  title: "Text processing patterns",      objective: "Tokenise, clean, and reshape messy text into structured records." },
  { day: 64, stat: "CRAFT", title: "pathlib & the filesystem",      objective: "Path objects, globbing, reading trees, safe joins, temp files." },
  { day: 65, stat: "CRAFT", title: "Bytes, encoding, base64",       objective: "str vs bytes, encode/decode, utf-8 pitfalls, base64, hashing." },
  { day: 66, stat: "CRAFT", title: "HTTP & REST APIs",              objective: "Requests, status codes, headers, query params (against mocked responses)." },
  { day: 67, stat: "DATA",  title: "Consuming & shaping JSON",       objective: "Walk nested JSON, pick fields, flatten, and re-serialise." },
  { day: 68, stat: "DATA",  title: "Tabular data without a library",objective: "Group, aggregate and pivot rows of dicts — the job pandas automates." },
  { day: 69, stat: "CRAFT", title: "Applied — practice mix",        objective: "A small ETL: read a file, transform, validate, write a report." },
  { day: 70, stat: "CRAFT", title: "A+-Rank Gate — The Pipeline",   objective: "BOSS: ingest raw data, clean it, summarise it, and emit JSON + text." },

  /* ---- Phase 8 · Algorithms & problem solving (71-80) ---- */
  { day: 71, stat: "FLOW",  title: "Two pointers & sliding window", objective: "In-place scans over sorted/streamed data; window sums and maxes." },
  { day: 72, stat: "DATA",  title: "Hash maps for speed",           objective: "Trade memory for time: seen-sets, counting, index maps, dedupe." },
  { day: 73, stat: "FUNC",  title: "Backtracking",                   objective: "Recursion that undoes itself: permutations, subsets, the N-queens shape." },
  { day: 74, stat: "FLOW",  title: "Sorting, deeper",               objective: "key= functions, stability, sorting by multiple fields, counting sort." },
  { day: 75, stat: "FLOW",  title: "Binary search as a mindset",    objective: "Search an answer space, not just a list; bisect; first-true problems." },
  { day: 76, stat: "DATA",  title: "Stacks, queues, deques",        objective: "When each wins; balanced-brackets, BFS queue, monotonic stack." },
  { day: 77, stat: "FLOW",  title: "Trees & graphs",                objective: "Adjacency lists, DFS & BFS, visited sets, shortest path by BFS." },
  { day: 78, stat: "FUNC",  title: "Dynamic programming",           objective: "Overlapping subproblems: memoise, then tabulate; classic 1-D DPs." },
  { day: 79, stat: "FLOW",  title: "Algorithms — practice mix",     objective: "Interview-style set: pick the technique, then implement cleanly." },
  { day: 80, stat: "FLOW",  title: "AA-Rank Gate — The Gauntlet",   objective: "BOSS: solve a multi-part problem set under a complexity budget." },

  /* ---- Phase 9 · Idiomatic & advanced Python (81-90) ---- */
  { day: 81, stat: "FUNC",  title: "Generator pipelines",           objective: "Chain lazy generators; itertools recipes; process huge input in O(1) memory." },
  { day: 82, stat: "FUNC",  title: "functools",                      objective: "reduce, partial, lru_cache, cached_property, singledispatch, wraps." },
  { day: 83, stat: "FUNC",  title: "Decorators, advanced",          objective: "Parameterised decorators, class decorators, and decorators as classes." },
  { day: 84, stat: "OOP",   title: "Descriptors & __slots__",       objective: "How @property really works; managed attributes; memory-lean classes." },
  { day: 85, stat: "OOP",   title: "__init_subclass__ & metaclasses",objective: "Hook subclass creation; a light, practical look at metaclasses." },
  { day: 86, stat: "CRAFT", title: "Context managers II",           objective: "contextlib (ExitStack, suppress, closing); reusable resource patterns." },
  { day: 87, stat: "DATA",  title: "Enums & named records",         objective: "Enum, IntEnum, auto(); namedtuple vs typing.NamedTuple vs dataclass." },
  { day: 88, stat: "FLOW",  title: "Structural pattern matching",   objective: "match / case: literals, sequences, mappings, class patterns, guards." },
  { day: 89, stat: "FUNC",  title: "Idioms — practice mix",         objective: "Refactor blunt code into idiomatic Python without changing behaviour." },
  { day: 90, stat: "FUNC",  title: "AAA-Rank Gate — The Idiom Trial",objective: "BOSS: re-implement a crude module the Pythonic way, tests still green." },

  /* ---- Phase 10 · Shipping real software (91-100) ---- */
  { day: 91, stat: "CRAFT", title: "Packaging a project",           objective: "pyproject.toml, src layout, console entry points, versioning." },
  { day: 92, stat: "CRAFT", title: "Type checking with mypy",       objective: "Gradual typing, Optional, Union, Protocols, generics, TypedDict." },
  { day: 93, stat: "CRAFT", title: "Testing II — pytest",           objective: "Fixtures, parametrize, mocking, coverage, testing error paths." },
  { day: 94, stat: "CRAFT", title: "Logging like a pro",            objective: "logging module: levels, handlers, formatters, why not print()." },
  { day: 95, stat: "FLOW",  title: "Profiling & performance",       objective: "timeit, cProfile; find the hot path before optimising; big wins first." },
  { day: 96, stat: "CRAFT", title: "Concurrency, the map",          objective: "Threads vs processes vs async; the GIL; which to reach for and when." },
  { day: 97, stat: "FUNC",  title: "async / await",                 objective: "Coroutines, the event loop, tasks, gather; async generators." },
  { day: 98, stat: "OOP",   title: "Validated data models",         objective: "dataclasses with __post_init__ validation; a Pydantic-style pattern." },
  { day: 99, stat: "CRAFT", title: "Capstone — spec & scaffold",    objective: "Turn an idea into modules, interfaces, a test plan and a CLI." },
  { day: 100, stat: "CRAFT", title: "The Monarch's Gate",           objective: "FINAL BOSS: design, build, test and package a complete program." },
];

export function topicFor(day) {
  return TOPIC_MAP.find((t) => t.day === day) || null;
}

/* =================================================================== */
/*  PRACTICE BANK — real graded problems, keyed by stat                */
/*  Used to synthesize a playable Dungeon for any not-yet-authored day. */
/* =================================================================== */
export const PRACTICE = {
  SYN: [
    {
      brief: "Write  to_celsius(f)  converting Fahrenheit to Celsius: (f - 32) * 5 / 9. Round to 1 decimal place.",
      starter: "def to_celsius(f):\n    pass\n",
      tests: [
        { label: "212F -> 100.0", code: "assert to_celsius(212) == 100.0" },
        { label: "32F -> 0.0", code: "assert to_celsius(32) == 0.0" },
        { label: "98.6F -> 37.0", code: "assert to_celsius(98.6) == 37.0" },
      ],
    },
    {
      brief: "Write  receipt_line(name, qty, price)  -> a string like  'Potion x3    9.00'  " +
        "(name, then 'x' and qty, padded to at least 12 chars total, then price with 2 decimals).",
      starter: "def receipt_line(name, qty, price):\n    pass\n",
      tests: [
        { label: "basic", code: "assert receipt_line('Potion', 3, 3.0) == 'Potion x3    9.00'" },
        { label: "price is qty*price", code: "assert receipt_line('Elixir', 2, 5.5).endswith('11.00')" },
      ],
    },
    {
      brief: "Write  initials(full_name)  -> uppercase initials with dots, e.g.  'sung jin woo' -> 'S.J.W.'",
      starter: "def initials(full_name):\n    pass\n",
      tests: [
        { label: "three names", code: "assert initials('sung jin woo') == 'S.J.W.'" },
        { label: "two names", code: "assert initials('Cha Hae') == 'C.H.'" },
      ],
    },
    {
      brief: "Write  slugify(title)  -> lowercase, spaces to '-', drop anything that isn't a letter, digit or '-', collapse repeats.  'Hello,  World!' -> 'hello-world'",
      starter: "def slugify(title):\n    pass\n",
      tests: [
        { label: "basic", code: "assert slugify('Hello,  World!') == 'hello-world'" },
        { label: "trim + collapse", code: "assert slugify('  A---B  ') == 'a-b'" },
        { label: "keeps digits", code: "assert slugify('Top 10 Tips') == 'top-10-tips'" },
      ],
    },
    {
      brief: "Write  tokens(expr)  -> split a math string into number / operator tokens (operators: + - * / ( )).  '12+3*(4-1)' -> ['12','+','3','*','(','4','-','1',')']",
      starter: "def tokens(expr):\n    pass\n",
      tests: [
        { label: "mixed", code: "assert tokens('12+3*(4-1)') == ['12','+','3','*','(','4','-','1',')']" },
        { label: "spaces ignored", code: "assert tokens(' 7 -  20 ') == ['7','-','20']" },
      ],
    },
  ],
  FLOW: [
    {
      brief: "Write  is_leap(year)  -> True if it's a leap year (divisible by 4, except centuries unless divisible by 400).",
      starter: "def is_leap(year):\n    pass\n",
      tests: [
        { label: "2000 leap", code: "assert is_leap(2000) is True" },
        { label: "1900 not leap", code: "assert is_leap(1900) is False" },
        { label: "2024 leap", code: "assert is_leap(2024) is True" },
        { label: "2023 not leap", code: "assert is_leap(2023) is False" },
      ],
    },
    {
      brief: "Write  biggest(a, b, c)  returning the largest of three numbers WITHOUT using max().",
      starter: "def biggest(a, b, c):\n    pass\n",
      tests: [
        { label: "middle", code: "assert biggest(3, 9, 5) == 9" },
        { label: "last", code: "assert biggest(1, 2, 8) == 8" },
        { label: "first", code: "assert biggest(10, 2, 8) == 10" },
      ],
    },
    {
      brief: "Write  collatz_steps(n)  -> how many steps to reach 1 (even: n//2, odd: 3n+1). collatz_steps(1) -> 0.",
      starter: "def collatz_steps(n):\n    pass\n",
      tests: [
        { label: "1 -> 0", code: "assert collatz_steps(1) == 0" },
        { label: "6 -> 8", code: "assert collatz_steps(6) == 8" },
        { label: "27 -> 111", code: "assert collatz_steps(27) == 111" },
      ],
    },
    {
      brief: "Write  max_window(nums, k)  -> list of the max of every length-k window.  [1,3,-1,-3,5,3,6,7], k=3 -> [3,3,5,5,6,7]",
      starter: "def max_window(nums, k):\n    pass\n",
      tests: [
        { label: "classic", code: "assert max_window([1,3,-1,-3,5,3,6,7], 3) == [3,3,5,5,6,7]" },
        { label: "k == 1", code: "assert max_window([4,2,9], 1) == [4,2,9]" },
        { label: "k == len", code: "assert max_window([4,2,9], 3) == [9]" },
      ],
    },
    {
      brief: "Write  first_true(lo, hi, pred)  -> smallest n in [lo, hi] where pred(n) is True (pred is monotonic: once True it stays True). Return hi+1 if never.",
      starter: "def first_true(lo, hi, pred):\n    pass\n",
      tests: [
        { label: "threshold", code: "assert first_true(0, 100, lambda n: n*n >= 50) == 8" },
        { label: "already true", code: "assert first_true(5, 9, lambda n: True) == 5" },
        { label: "never", code: "assert first_true(0, 3, lambda n: False) == 4" },
      ],
    },
  ],
  DATA: [
    {
      brief: "Write  word_count(text)  -> a dict mapping each lowercased word to how many times it appears.",
      starter: "def word_count(text):\n    pass\n",
      tests: [
        { label: "counts", code: "assert word_count('a b a A') == {'a': 3, 'b': 1}" },
        { label: "empty", code: "assert word_count('') == {}" },
      ],
    },
    {
      brief: "Write  dedupe(items)  -> a list with duplicates removed but original order kept.",
      starter: "def dedupe(items):\n    pass\n",
      tests: [
        { label: "keeps order", code: "assert dedupe([3, 1, 3, 2, 1]) == [3, 1, 2]" },
        { label: "no dupes", code: "assert dedupe(['a', 'b']) == ['a', 'b']" },
      ],
    },
    {
      brief: "Write  flatten(nested)  -> flatten one level:  [[1,2],[3],[4,5]] -> [1,2,3,4,5] .",
      starter: "def flatten(nested):\n    pass\n",
      tests: [
        { label: "one level", code: "assert flatten([[1, 2], [3], [4, 5]]) == [1, 2, 3, 4, 5]" },
        { label: "empty inners", code: "assert flatten([[], [1], []]) == [1]" },
      ],
    },
    {
      brief: "Write  group_by(rows, key)  -> dict mapping each rows[i][key] to the list of rows with that value, order preserved.",
      starter: "def group_by(rows, key):\n    pass\n",
      tests: [
        { label: "groups", code: "r=[{'t':'a','n':1},{'t':'b','n':2},{'t':'a','n':3}]\nassert group_by(r,'t') == {'a':[{'t':'a','n':1},{'t':'a','n':3}], 'b':[{'t':'b','n':2}]}" },
        { label: "empty", code: "assert group_by([], 'x') == {}" },
      ],
    },
    {
      brief: "Write  balanced(s)  -> True if every '(' '[' '{' is closed by the right bracket in the right order.",
      starter: "def balanced(s):\n    pass\n",
      tests: [
        { label: "ok", code: "assert balanced('([]{()})') is True" },
        { label: "wrong order", code: "assert balanced('([)]') is False" },
        { label: "unclosed", code: "assert balanced('(((') is False" },
      ],
    },
  ],
  FUNC: [
    {
      brief: "Write  compose(f, g)  -> returns a new function h where  h(x) == f(g(x)) .",
      starter: "def compose(f, g):\n    pass\n",
      tests: [
        { label: "adds then doubles", code: "h = compose(lambda x: x*2, lambda x: x+1)\nassert h(3) == 8" },
        { label: "identity-ish", code: "h = compose(str, int)\nassert h('7') == '7'" },
      ],
    },
    {
      brief: "Write  memo_fib(n)  -> nth Fibonacci number (fib(0)=0, fib(1)=1) using a dict cache. Must handle fib(50) instantly.",
      starter: "def memo_fib(n, _cache={}):\n    pass\n",
      tests: [
        { label: "fib(10)", code: "assert memo_fib(10) == 55" },
        { label: "fib(1)", code: "assert memo_fib(1) == 1" },
        { label: "fib(50) fast", code: "assert memo_fib(50) == 12586269025" },
      ],
    },
    {
      brief: "Write  average(*nums)  -> the mean of any number of arguments. average() with no args -> 0.",
      starter: "def average(*nums):\n    pass\n",
      tests: [
        { label: "three", code: "assert average(2, 4, 6) == 4" },
        { label: "none", code: "assert average() == 0" },
      ],
    },
    {
      brief: "Write a decorator  once(fn)  -> the wrapped function runs only the first time; later calls return that first result without re-running.",
      starter: "def once(fn):\n    pass\n",
      tests: [
        { label: "runs once", code: "calls=[]\n@once\ndef f():\n    calls.append(1)\n    return 42\nassert f() == 42 and f() == 42 and len(calls) == 1" },
      ],
    },
    {
      brief: "Write  permutations(items)  -> a list of every ordering of the list (backtracking). permutations([1,2,3]) has 6 entries; permutations([]) -> [[]].",
      starter: "def permutations(items):\n    pass\n",
      tests: [
        { label: "count", code: "assert len(permutations([1,2,3])) == 6" },
        { label: "contents", code: "assert sorted(permutations([1,2])) == [[1,2],[2,1]]" },
        { label: "empty", code: "assert permutations([]) == [[]]" },
      ],
    },
  ],
  OOP: [
    {
      brief: "Write a class  BankAccount(balance=0)  with  deposit(amount) ,  withdraw(amount)  " +
        "(raise ValueError if it would go negative), and a  balance  attribute.",
      starter: "class BankAccount:\n    def __init__(self, balance=0):\n        self.balance = balance\n",
      tests: [
        { label: "deposit", code: "a = BankAccount()\na.deposit(50)\nassert a.balance == 50" },
        { label: "withdraw", code: "a = BankAccount(100)\na.withdraw(30)\nassert a.balance == 70" },
        { label: "overdraw raises", code: "a = BankAccount(10)\ntry:\n    a.withdraw(999)\n    assert False\nexcept ValueError:\n    pass" },
      ],
    },
    {
      brief: "Write  Rectangle(w, h)  with  area() ,  perimeter() , and  __repr__  giving  'Rectangle(3, 4)' .",
      starter: "class Rectangle:\n    def __init__(self, w, h):\n        self.w = w\n        self.h = h\n",
      tests: [
        { label: "area", code: "assert Rectangle(3, 4).area() == 12" },
        { label: "perimeter", code: "assert Rectangle(3, 4).perimeter() == 14" },
        { label: "repr", code: "assert repr(Rectangle(3, 4)) == 'Rectangle(3, 4)'" },
      ],
    },
    {
      brief: "Write a  Stack  class:  push(x) ,  pop() -> top item (raise IndexError if empty),  peek() ,  is_empty() .",
      starter: "class Stack:\n    def __init__(self):\n        self._items = []\n",
      tests: [
        { label: "lifo", code: "s = Stack()\ns.push(1)\ns.push(2)\nassert s.pop() == 2 and s.pop() == 1" },
        { label: "empty pop raises", code: "s = Stack()\ntry:\n    s.pop()\n    assert False\nexcept IndexError:\n    pass" },
        { label: "peek keeps it", code: "s = Stack()\ns.push(9)\nassert s.peek() == 9 and s.is_empty() is False" },
      ],
    },
    {
      brief: "Write  Vector(x, y)  supporting  +  and  ==  (via __add__ / __eq__) and  __repr__ giving 'Vector(1, 2)'.",
      starter: "class Vector:\n    def __init__(self, x, y):\n        self.x = x\n        self.y = y\n",
      tests: [
        { label: "add", code: "assert (Vector(1,2) + Vector(3,4)) == Vector(4,6)" },
        { label: "repr", code: "assert repr(Vector(1,2)) == 'Vector(1, 2)'" },
      ],
    },
    {
      brief: "Write a class  Timer  usable as a context manager:  with Timer() as t: ...  then  t.elapsed  is a float >= 0 (seconds). Use time.perf_counter.",
      starter: "import time\n\nclass Timer:\n    pass\n",
      tests: [
        { label: "works as CM", code: "with Timer() as t:\n    sum(range(1000))\nassert isinstance(t.elapsed, float) and t.elapsed >= 0" },
      ],
    },
  ],
  CRAFT: [
    {
      brief: "Write  safe_div(a, b)  -> a / b, but return the string 'undefined' instead of crashing on divide-by-zero.",
      starter: "def safe_div(a, b):\n    pass\n",
      tests: [
        { label: "normal", code: "assert safe_div(10, 2) == 5.0" },
        { label: "by zero", code: "assert safe_div(1, 0) == 'undefined'" },
      ],
    },
    {
      brief: "Write  parse_config(text)  turning  'hp=100;name=Jin;lvl=4'  into  {'hp': '100', 'name': 'Jin', 'lvl': '4'} .",
      starter: "def parse_config(text):\n    pass\n",
      tests: [
        { label: "parses", code: "assert parse_config('hp=100;name=Jin') == {'hp': '100', 'name': 'Jin'}" },
        { label: "single", code: "assert parse_config('x=1') == {'x': '1'}" },
      ],
    },
    {
      brief: "Write a generator  running_max(nums)  that yields the largest value seen so far at each step.",
      starter: "def running_max(nums):\n    pass\n",
      tests: [
        { label: "climbs", code: "assert list(running_max([1, 3, 2, 5, 4])) == [1, 3, 3, 5, 5]" },
        { label: "descending", code: "assert list(running_max([9, 1, 1])) == [9, 9, 9]" },
      ],
    },
    {
      brief: "Write  retry(fn, attempts)  -> call fn(); if it raises, try again, up to `attempts` times; return its value, or re-raise the last exception.",
      starter: "def retry(fn, attempts):\n    pass\n",
      tests: [
        { label: "succeeds late", code: "st={'n':0}\ndef f():\n    st['n']+=1\n    if st['n']<3: raise ValueError('x')\n    return 'ok'\nassert retry(f,5)=='ok' and st['n']==3" },
        { label: "gives up", code: "def g():\n    raise KeyError('nope')\ntry:\n    retry(g,2)\n    assert False\nexcept KeyError:\n    pass" },
      ],
    },
    {
      brief: "Write  parse_query(qs)  -> turn 'a=1&b=two&a=3' into {'a': ['1','3'], 'b': ['two']} (values always lists, order kept).",
      starter: "def parse_query(qs):\n    pass\n",
      tests: [
        { label: "repeats", code: "assert parse_query('a=1&b=two&a=3') == {'a':['1','3'],'b':['two']}" },
        { label: "empty", code: "assert parse_query('') == {}" },
      ],
    },
  ],
};

/* Resolve the content for any day: authored if present, otherwise a
   synthesized outline day backed by a real practice problem so the run
   stays playable all the way to day 60. */
export function dayContent(day) {
  const authored = DAYS.find((d) => d.day === day);
  if (authored) return authored;

  const topic = topicFor(day);
  if (!topic) return null;

  const bank = PRACTICE[topic.stat] || PRACTICE.SYN;
  const problem = bank[day % bank.length];
  const boss = isBossDay(day);

  return {
    day,
    title: topic.title,
    stat: topic.stat,
    system: boss
      ? `The ${RANKS[BOSS_DAYS[day]]}-Rank Gate. Objective: ${topic.objective} Full authoring of this Gate is pending — clear the trial below to hold your rank.`
      : `Scouted, not yet fully mapped. Objective: ${topic.objective}`,
    boss,
    outline: true,
    concepts: [
      topic.objective,
      "This day's guided lessons are still being written. The Dungeon below is a real, graded challenge for this stat — clear it to advance.",
    ],
    lessons: [],
    dungeon: {
      brief: problem.brief,
      starter: problem.starter,
      stat: topic.stat,
      xp: boss ? 85 : 46,
      tests: problem.tests,
    },
  };
}

/* --------------------------- achievements ----------------------- */
/* Each: id, name, note, and test(save) -> bool. `save` is the live
   progress object from PyWots.jsx. */
export const ACHIEVEMENTS = [
  { id: "first_blood", name: "First Blood",  note: "Clear your first Dungeon.",
    test: (s) => clearedDungeons(s) >= 1 },
  { id: "week_one",    name: "Survived Week One", note: "Reach Day 8.",
    test: (s) => (s.day || 1) >= 8 },
  { id: "gate_d",      name: "D-Rank Hunter", note: "Clear the E-Rank Gate (Day 7).",
    test: (s) => !!(s.completed?.[7]?.boss) },
  { id: "loopmancer",  name: "Loopmancer",   note: "Clear the D-Rank Gate (Day 10).",
    test: (s) => !!(s.completed?.[10]?.boss) },
  { id: "flawless",    name: "Flawless",      note: "Clear a Dungeon without opening a hint.",
    test: (s) => (s.flawless || 0) >= 1 },
  { id: "streak_7",    name: "Disciplined",   note: "Hold a 7-day streak.",
    test: (s) => (s.bestStreak || 0) >= 7 },
  { id: "streak_30",   name: "Unbroken",      note: "Hold a 30-day streak.",
    test: (s) => (s.bestStreak || 0) >= 30 },
  { id: "level_10",    name: "Double Digits", note: "Reach Level 10.",
    test: (s) => levelFromXP(s.xp || 0).level >= 10 },
  { id: "halfway",     name: "Halfway to the Top", note: "Reach Day 50.",
    test: (s) => (s.day || 1) >= 50 },
  { id: "s_rank",      name: "S-Rank Hunter", note: "Clear the S-Rank Gate (Day 50).",
    test: (s) => !!(s.completed?.[50]?.boss) },
  { id: "algo_gate",   name: "Gauntlet Runner", note: "Clear the Algorithm Gate (Day 80).",
    test: (s) => !!(s.completed?.[80]?.boss) },
  { id: "streak_100",  name: "Century", note: "Hold a 100-day streak.",
    test: (s) => (s.bestStreak || 0) >= 100 },
  { id: "level_25",    name: "Ascendant", note: "Reach Level 25.",
    test: (s) => levelFromXP(s.xp || 0).level >= 25 },
  { id: "monarch",     name: "The Python Monarch", note: "Clear the Monarch's Gate (Day 100).",
    test: (s) => !!(s.completed?.[100]?.boss) },
];

export function clearedDungeons(save) {
  const c = save.completed || {};
  return Object.keys(c).filter((k) => c[k] && c[k].dungeon).length;
}

export function earnedAchievements(save) {
  return ACHIEVEMENTS.filter((a) => {
    try { return a.test(save); } catch { return false; }
  }).map((a) => a.id);
}
