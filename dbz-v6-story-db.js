/* Dragon Ball canon-core story packs for the v6 progression engine. */
(function initializeDragonBallStoryData() {
    "use strict";

    if (!globalThis.DBZ_V6_STORY_DATA) {
        globalThis.DBZ_V6_STORY_DATA = {
            version: "6.4.0",
            sagas: {},
            characters: {},
            relationships: {}
        };
    }

    Object.assign(globalThis.DBZ_V6_STORY_DATA.sagas, {
        db_pilaf: {
            id: "db_pilaf",
            title: "The Hunt for the Dragon Balls",
            series: "DB",
            continuity: "canon_core",
            sourceNote: "Dragon Ball manga chapters 1-23 (the first Dragon Ball quest); anime episodes 1-13.",
            sourceScope: { mangaChapters: "1-23", animeEpisodes: "1-13" },
            entries: [
                {
                    id: "db_pilaf_story_01",
                    order: 1,
                    phase: "entry",
                    focusRatio: 0,
                    title: "A Girl, a Radar, and a Strange Boy",
                    canonText: "Bulma's search for the seven Dragon Balls leads her to Mount Paozu, where her car strikes a remarkably resilient boy named Goku. He owns the four-star ball as a keepsake from his grandfather. After learning that gathering all seven can summon a wish-granting dragon, Goku agrees to protect Bulma and travel beyond his mountain home for the first time.",
                    characterText: "Goku begins with immense strength, little knowledge of society, and complete openness to discovery. Bulma supplies the plan, technology, and worldly impatience that turn a chance meeting into a shared quest.",
                    playerReflection: "A new path often starts when curiosity meets a reason to leave familiar ground. What goal is worth beginning before you feel fully prepared?",
                    characters: ["goku", "bulma"],
                    tags: ["dragon-balls", "first-meeting", "adventure", "curiosity"]
                },
                {
                    id: "db_pilaf_story_02",
                    order: 2,
                    phase: "development",
                    focusRatio: 0.14,
                    title: "The Terror of Aru Village",
                    canonText: "In Aru Village, the travelers find homes emptied by Oolong, a shapeshifter who demands that families surrender their daughters. Goku confronts him and discovers that his transformations last only briefly. Once exposed, Oolong admits the abducted girls have been living comfortably rather than harmed. Bulma recruits the reluctant trickster, whose local knowledge and transformations may still prove useful.",
                    characterText: "Oolong hides cowardice behind frightening appearances, while Goku judges him by what he actually does. Bulma sees that a flawed former opponent can become a useful companion when held accountable.",
                    playerReflection: "Appearances can manufacture fear, but steady observation reveals real limits. Which intimidating obstacle becomes manageable once you examine how it works?",
                    characters: ["goku", "bulma", "oolong"],
                    tags: ["aru-village", "shapeshifting", "accountability", "team-building"]
                },
                {
                    id: "db_pilaf_story_03",
                    order: 3,
                    phase: "development",
                    focusRatio: 0.3,
                    title: "Bandits in the Desert",
                    canonText: "Crossing the desert, the group is ambushed by Yamcha and Puar. Yamcha's martial skill presses Goku until his nervousness around girls forces him to retreat. After overhearing the Dragon Ball legend, Yamcha follows the travelers, hoping a wish might cure that weakness. Rivalry becomes an uneasy parallel journey as both sides watch for the next advantage.",
                    characterText: "Yamcha is capable but constrained by embarrassment he cannot fight directly. Puar's loyalty steadies him, while Goku responds to the desert bandit with competition rather than a lasting grudge.",
                    playerReflection: "Skill does not erase a hidden weakness. Naming the thing that makes you retreat is often the first practical step toward changing it.",
                    characters: ["goku", "yamcha", "puar", "bulma", "oolong"],
                    tags: ["desert", "rivalry", "yamcha", "self-awareness"]
                },
                {
                    id: "db_pilaf_story_04",
                    order: 4,
                    phase: "development",
                    focusRatio: 0.48,
                    title: "Fire Mountain",
                    canonText: "A Dragon Ball lies in Ox-King's castle, surrounded by an uncontrollable inferno. Goku meets Ox-King's daughter Chi-Chi and seeks help from Master Roshi. Roshi's Kamehameha extinguishes the fire but also levels the mountain. After watching once, Goku produces a smaller wave himself. Amid the confusion, he also innocently agrees to return and marry Chi-Chi someday.",
                    characterText: "Roshi reveals the disciplined power behind his eccentric manner, and Goku's gift for learning becomes unmistakable. Chi-Chi takes Goku's simple promise seriously even though he does not understand its meaning.",
                    playerReflection: "Inspiration can reveal what is possible, but promises carry weight even when made casually. What have you learned—or agreed to—faster than you understood?",
                    characters: ["goku", "chi-chi", "master-roshi", "ox-king", "bulma"],
                    tags: ["fire-mountain", "kamehameha", "promise", "learning"]
                },
                {
                    id: "db_pilaf_story_05",
                    order: 5,
                    phase: "preclimax",
                    focusRatio: 0.7,
                    title: "Pilaf's Castle",
                    canonText: "At Pilaf's desert castle, Shu and Mai steal the collected Dragon Balls and trap Goku's group inside. Emperor Pilaf brings all seven together and summons Shenron, intending to claim world rule. The companions can see the dragon but cannot reach the courtyard in time. Their grand adventure narrows to a single desperate chance to speak before Pilaf does.",
                    characterText: "Pilaf mistakes possession for victory, while the trapped travelers discover that no single member can solve every problem. Their survival now depends on the least heroic-looking member acting decisively.",
                    playerReflection: "Preparation can still end in a last-second crisis. When the original plan fails, who on your team has an overlooked way forward?",
                    characters: ["emperor-pilaf", "shu", "mai", "goku", "bulma", "oolong", "yamcha", "puar"],
                    tags: ["pilaf-castle", "shenron", "capture", "crisis"]
                },
                {
                    id: "db_pilaf_story_06",
                    order: 6,
                    phase: "resolution",
                    title: "The Wish That Spoiled an Empire",
                    canonText: "Oolong escapes the chamber in time to shout his own frivolous wish, preventing Pilaf from ruling the world. Shenron grants it, then the Dragon Balls scatter across the globe and become inert for a year. Furious, Pilaf seals the group beneath reinforced glass and plans to let the rising sun finish them, apparently leaving no route out.",
                    characterText: "Oolong's motive is hardly noble, yet his quick action saves everyone and protects the world. The moment separates useful courage from impressive appearances: the coward acts while stronger allies remain trapped.",
                    playerReflection: "A timely imperfect action can matter more than an ideal response that arrives too late. Where would decisiveness serve you better than polish?",
                    characters: ["oolong", "emperor-pilaf", "shenron", "goku", "bulma", "yamcha", "puar"],
                    tags: ["wish", "improvisation", "resolution", "teamwork"]
                },
                {
                    id: "db_pilaf_story_07",
                    order: 7,
                    phase: "mastery",
                    title: "Moonlight and New Directions",
                    canonText: "Moonlight transforms Goku into a Great Ape, whose uncontrolled strength shatters Pilaf's castle and frees the prisoners. Yamcha and Puar identify his tail as the key and remove it, returning him to normal with no memory of the destruction. With the quest ended, Yamcha and Bulma head toward city life while Goku chooses martial-arts training with Master Roshi.",
                    characterText: "Goku's greatest power is also a danger he cannot yet recognize or direct. The group's escape succeeds because Yamcha observes the pattern, Puar acts on it, and everyone survives together.",
                    playerReflection: "Mastery begins by respecting power you do not yet control. Progress also means choosing the next discipline after an exciting first goal is over.",
                    characters: ["goku", "yamcha", "puar", "bulma", "oolong", "emperor-pilaf"],
                    tags: ["great-ape", "escape", "new-direction", "mastery"]
                }
            ]
        },

        db_tournament: {
            id: "db_tournament",
            title: "The 21st World Martial Arts Tournament",
            series: "DB",
            continuity: "canon_core",
            sourceNote: "Dragon Ball manga chapters 24-54 (Master Roshi's training and the 21st Tenkaichi Budokai); anime episodes 14-28.",
            sourceScope: { mangaChapters: "24-54", animeEpisodes: "14-28" },
            entries: [
                {
                    id: "db_tournament_story_01",
                    order: 1,
                    phase: "entry",
                    focusRatio: 0,
                    title: "Two Students at Kame House",
                    canonText: "Goku reaches Kame House seeking Master Roshi's instruction and meets Krillin, another hopeful student with more guile than confidence. Roshi agrees to train them after they bring the fugitive Launch to live at the house. The boys begin as rivals for approval, but sharing chores, meals, and an impossible teacher soon turns rivalry into the foundation of friendship.",
                    characterText: "Goku approaches training without status or strategy; Krillin arrives ready to manipulate any advantage. Roshi accepts both, seeing potential that needs character and endurance as much as technique.",
                    playerReflection: "A rival can become your best training partner when both of you accept the same demanding standard. Who makes your effort more honest?",
                    characters: ["goku", "krillin", "master-roshi", "launch"],
                    tags: ["kame-house", "training", "rivalry", "friendship"]
                },
                {
                    id: "db_tournament_story_02",
                    order: 2,
                    phase: "development",
                    focusRatio: 0.14,
                    title: "The Turtle School Method",
                    canonText: "Roshi does not begin with secret attacks. Wearing heavy turtle shells, Goku and Krillin deliver milk, plow fields with their hands, swim through dangerous water, dodge hazards, and study. Months of ordinary labor build extraordinary bodies. When Roshi finally removes their shells before the tournament, both students discover how much speed and strength their daily consistency has created.",
                    characterText: "Roshi teaches that martial arts support a full life rather than replacing it. Goku and Krillin learn to work, study, eat, rest, and train as parts of one discipline.",
                    playerReflection: "Visible breakthroughs are usually the receipt for quiet repetition. Which unglamorous practice would make the rest of your performance feel lighter?",
                    characters: ["goku", "krillin", "master-roshi"],
                    tags: ["turtle-school", "conditioning", "consistency", "discipline"]
                },
                {
                    id: "db_tournament_story_03",
                    order: 3,
                    phase: "development",
                    focusRatio: 0.3,
                    title: "Eight Finalists",
                    canonText: "At the 21st World Martial Arts Tournament, Goku and Krillin move through the crowded preliminaries and reach the final eight. Roshi secretly enters as Jackie Chun, determined to test his students without the comfort of recognizing their teacher. The bracket also includes Yamcha, Nam, Ranfan, Giran, and Bacterian, each bringing a different problem that raw strength alone cannot answer.",
                    characterText: "Roshi hides his identity not for vanity but to protect his students from early complacency. The young fighters arrive excited; their teacher arrives prepared to make success difficult enough to remain useful.",
                    playerReflection: "A good test measures adaptability, not just your favorite strength. How well does your preparation hold when the challenge changes shape?",
                    characters: ["goku", "krillin", "master-roshi", "yamcha", "nam", "giran", "ranfan", "bacterian"],
                    tags: ["tournament", "preliminaries", "jackie-chun", "adaptability"]
                },
                {
                    id: "db_tournament_story_04",
                    order: 4,
                    phase: "development",
                    focusRatio: 0.48,
                    title: "Lessons in the Quarterfinals",
                    canonText: "Krillin overcomes Bacterian's foul tactics after remembering he has no nose. Jackie Chun defeats Yamcha with effortless control, Ranfan uses distraction against Nam, and Goku escapes Giran's binding gum before winning. The varied matches reward clear thinking under pressure. Between contests, Roshi also learns that Nam fights to buy water for his drought-stricken village and quietly helps him afterward.",
                    characterText: "Krillin turns an apparent disadvantage into the solution, while Goku keeps testing the limits of confinement. Roshi watches character as closely as skill and responds privately to Nam's selfless purpose.",
                    playerReflection: "Pressure exposes whether you can notice the simple fact everyone else overlooks. What assumption about your limits deserves to be checked again?",
                    characters: ["goku", "krillin", "master-roshi", "yamcha", "nam", "giran", "ranfan", "bacterian"],
                    tags: ["quarterfinals", "problem-solving", "sportsmanship", "purpose"]
                },
                {
                    id: "db_tournament_story_05",
                    order: 5,
                    phase: "preclimax",
                    focusRatio: 0.7,
                    title: "Teacher and Students Advance",
                    canonText: "Jackie Chun faces Krillin in a rapid exchange whose decisive moments happen faster than the audience can follow. Krillin fights cleverly, but Roshi's experience carries him into the final. Goku then defeats Nam by surviving his aerial attack and keeping his balance. With student and disguised teacher remaining, Roshi realizes Goku is already capable of threatening his carefully planned lesson.",
                    characterText: "Krillin proves he belongs among serious fighters even in defeat. Goku's resilience forces Roshi to abandon any thought of an easy demonstration and compete with his full intelligence.",
                    playerReflection: "Losing to greater experience can still confirm real growth. Can you separate the result of one contest from the quality of your preparation?",
                    characters: ["goku", "krillin", "master-roshi", "nam"],
                    tags: ["semifinals", "experience", "resilience", "growth"]
                },
                {
                    id: "db_tournament_story_06",
                    order: 6,
                    phase: "resolution",
                    title: "The Final Count",
                    canonText: "Goku and Jackie Chun exhaust their techniques in a remarkably even final. When moonlight triggers Goku's Great Ape form, Chun destroys the moon to stop the danger without killing him. Returned to normal, Goku keeps fighting until both collapse after simultaneous kicks. They answer the count, but Chun's longer reach leaves him able to stand and declare victory first.",
                    characterText: "Goku brings limitless effort; Roshi answers with experience, restraint, and one final tactical margin. The teacher wins narrowly enough to inspire continued growth instead of crushing his student's confidence.",
                    playerReflection: "A narrow loss can be more valuable than an easy title when it shows both your progress and the next distance to travel.",
                    characters: ["goku", "master-roshi"],
                    tags: ["finals", "great-ape", "moon", "resolution"]
                },
                {
                    id: "db_tournament_story_07",
                    order: 7,
                    phase: "mastery",
                    title: "There Is Always Someone Better",
                    canonText: "After the tournament, Roshi's disguise has achieved its purpose: Goku and Krillin leave proud of their progress but not convinced they have reached the summit. Roshi's victory embodies the Turtle School ideal that training, competition, rest, and enjoyment belong together. Goku soon chooses a new journey to find his grandfather's four-star Dragon Ball, carrying disciplined habits into open adventure.",
                    characterText: "Roshi protects ambition by denying it premature certainty. Goku accepts defeat without bitterness, while Krillin leaves the tournament stronger, humbler, and securely connected to his new friend.",
                    playerReflection: "Mastery is not the belief that no one can beat you. It is the ability to finish one test eager to keep learning.",
                    characters: ["goku", "krillin", "master-roshi"],
                    tags: ["turtle-school", "humility", "lifelong-learning", "mastery"]
                }
            ]
        },

        db_red_ribbon: {
            id: "db_red_ribbon",
            title: "The Red Ribbon Army and Muscle Tower",
            series: "DB",
            continuity: "canon_core",
            sourceNote: "Dragon Ball manga chapters 55-69 (the early Red Ribbon search through Muscle Tower); anime episodes 29-45. General Blue's pursuit is excluded.",
            sourceScope: { mangaChapters: "55-69", animeEpisodes: "29-45" },
            entries: [
                {
                    id: "db_red_ribbon_story_01",
                    order: 1,
                    phase: "entry",
                    focusRatio: 0,
                    title: "The Four-Star Ball Search",
                    canonText: "Goku begins a solo search for the four-star Dragon Ball his grandfather left him. The same signal draws Colonel Silver and the Red Ribbon Army, a military organization gathering the balls by force. Silver shoots down the Flying Nimbus but is quickly defeated. Goku commandeers an army plane, only to crash in the frozen north after its controls carry him toward another signal.",
                    characterText: "Goku's wish is personal rather than grand: he wants to recover a family keepsake. Against him stands an organization that treats people, places, and the Dragon Balls as property to seize.",
                    playerReflection: "The same objective can reveal very different values through the way people pursue it. What method are you unwilling to excuse for a desired result?",
                    characters: ["goku", "colonel-silver", "commander-red", "staff-officer-black"],
                    tags: ["four-star-ball", "red-ribbon-army", "search", "values"]
                },
                {
                    id: "db_red_ribbon_story_02",
                    order: 2,
                    phase: "development",
                    focusRatio: 0.14,
                    title: "Suno and Jingle Village",
                    canonText: "A village girl named Suno finds Goku nearly frozen and brings him into her home. He learns that General White's forces occupy nearby Muscle Tower and hold the village chief hostage while searching for a Dragon Ball. With warm clothes and a clear reason to act, Goku heads into the snow and attacks the fortified tower alone to free someone he has never met.",
                    characterText: "Suno's family offers help before asking what Goku can do for them. Their hospitality gives Goku the context his radar cannot: a blinking target is also a community under occupation.",
                    playerReflection: "Data can point to a place, but people explain what matters there. Whose lived experience should inform the way you act on information?",
                    characters: ["goku", "suno", "general-white"],
                    tags: ["jingle-village", "hospitality", "muscle-tower", "rescue"]
                },
                {
                    id: "db_red_ribbon_story_03",
                    order: 3,
                    phase: "development",
                    focusRatio: 0.3,
                    title: "Ascending Muscle Tower",
                    canonText: "Goku fights upward through Muscle Tower, where each floor offers a new defense. He withstands Major Metallitron's mechanical strength and discovers that the giant is a machine whose battery eventually fails. The tower's design assumes attackers will be worn down by escalating force, but Goku's endurance and directness keep carrying him higher toward General White and the captive chief.",
                    characterText: "Goku does not confuse Metallitron's durability with endless energy. His persistence turns a seemingly tireless opponent into a finite problem, one floor in a larger climb.",
                    playerReflection: "Some obstacles look permanent only because their limits are hidden. What changes when you treat endurance as a resource that both sides must manage?",
                    characters: ["goku", "major-metallitron", "general-white"],
                    tags: ["muscle-tower", "android", "endurance", "progression"]
                },
                {
                    id: "db_red_ribbon_story_04",
                    order: 4,
                    phase: "development",
                    focusRatio: 0.48,
                    title: "Ninja Murasaki and Android 8",
                    canonText: "Ninja Murasaki tries camouflage, weapons, deception, and even his identical brothers, but Goku repeatedly breaks through the performance. Murasaki then activates Android 8 and orders him to kill. The powerful android refuses because he hates violence. Goku protects him from punishment, names him Eighter, and gains a companion whose gentleness matters more than the purpose for which he was built.",
                    characterText: "Eighter defines himself by a moral choice rather than his construction or orders. Goku recognizes that refusal as courage and offers friendship without demanding that Eighter prove it through violence.",
                    playerReflection: "Strength includes refusing a role that violates your values. Where might a calm no require more courage than a dramatic confrontation?",
                    characters: ["goku", "ninja-murasaki", "android-8"],
                    tags: ["muscle-tower", "android-8", "nonviolence", "friendship"]
                },
                {
                    id: "db_red_ribbon_story_05",
                    order: 5,
                    phase: "preclimax",
                    focusRatio: 0.7,
                    title: "The Monster Below",
                    canonText: "A trap drops Goku and Eighter into the tower's lower maze, where the rubbery monster Buyon absorbs blows and energy attacks. Goku notices the creature belongs in a warm environment. He breaks the wall, lets the northern cold freeze Buyon solid, and shatters the threat. Observation and surroundings accomplish what repeated direct attacks could not.",
                    characterText: "Goku's usual answer is greater effort, but Buyon forces him to read the environment. Eighter remains beside him, contributing loyal presence without abandoning his refusal to kill.",
                    playerReflection: "Persistence is not repetition without thought. When effort stops working, which feature of the environment could become part of the solution?",
                    characters: ["goku", "android-8", "buyon"],
                    tags: ["buyon", "environment", "adaptation", "preclimax"]
                },
                {
                    id: "db_red_ribbon_story_06",
                    order: 6,
                    phase: "resolution",
                    title: "General White's Last Shot",
                    canonText: "At the top of Muscle Tower, General White pretends to surrender after Goku frees the village chief. He then takes the chief hostage and shoots Goku at close range. Seeing his friend fall finally moves Eighter to strike White and send him flying from the tower. The prisoners escape, and the army's northern stronghold is no longer able to terrorize Jingle Village.",
                    characterText: "Eighter does not discard his peaceful nature; he makes one protective choice when White exploits mercy. His anger comes from loyalty, not appetite for combat, and ends the immediate danger.",
                    playerReflection: "A boundary backed by action can protect compassion from exploitation. What clear line lets you remain kind without becoming easy to harm?",
                    characters: ["goku", "android-8", "general-white", "village-chief"],
                    tags: ["general-white", "rescue", "protective-courage", "resolution"]
                },
                {
                    id: "db_red_ribbon_story_07",
                    order: 7,
                    phase: "mastery",
                    title: "The Village's New Protector",
                    canonText: "Eighter reveals that he found the local Dragon Ball and hid it so General White could not threaten the villagers after obtaining it. He gives the ball to Goku, who leaves him in the welcoming community he chose to defend. Muscle Tower's defeat matters not only as a victory over soldiers, but as proof that a weapon built for obedience can choose belonging instead.",
                    characterText: "Goku departs with a Dragon Ball and a new friend; Eighter gains a home without becoming what his makers intended. Suno's village answers coercion by making room for its protector.",
                    playerReflection: "Mastery includes knowing which victories are yours to carry onward and which should become safety, trust, and belonging for someone else.",
                    characters: ["goku", "android-8", "suno", "village-chief"],
                    tags: ["android-8", "dragon-ball", "belonging", "mastery"]
                }
            ]
        },

        db_general_blue: {
            id: "db_general_blue",
            title: "General Blue and the Pirate Cave",
            series: "DB",
            continuity: "canon_core",
            sourceNote: "Dragon Ball manga chapters 70-83 (General Blue's ocean and pirate-cave pursuit); anime episodes 46-57. Tao and Red Ribbon headquarters are excluded.",
            sourceScope: { mangaChapters: "70-83", animeEpisodes: "46-57" },
            entries: [
                {
                    id: "db_general_blue_story_01",
                    order: 1,
                    phase: "entry",
                    focusRatio: 0,
                    title: "A Signal Beneath the Sea",
                    canonText: "Goku's radar points beneath the ocean, so he returns to Bulma for equipment and brings Krillin into the search. Using a submarine from Master Roshi, the three descend toward the signal. General Blue's unit tracks them from the coast, turning a treasure hunt among friends into a military pursuit through waters that hide both an old pirate base and its defenses.",
                    characterText: "Bulma's engineering opens a route strength alone cannot reach, while Krillin adds judgment shaped by shared training. Goku's solo quest becomes collaborative again because the environment demands different abilities.",
                    playerReflection: "Some goals become reachable only when the team changes. Which missing capability should you invite instead of trying to imitate poorly?",
                    characters: ["goku", "bulma", "krillin", "master-roshi", "general-blue"],
                    tags: ["ocean", "submarine", "teamwork", "pursuit"]
                },
                {
                    id: "db_general_blue_story_02",
                    order: 2,
                    phase: "development",
                    focusRatio: 0.3,
                    title: "The Pirate Cave",
                    canonText: "Inside the submerged pirate cave, Goku, Bulma, and Krillin navigate traps left to protect a hoard of treasure. General Blue follows close behind as his pursuing soldiers fall to the defenses. A giant pirate robot attacks among collapsing passages and lava, forcing the friends to separate and improvise while Blue advances through the danger they have already triggered.",
                    characterText: "The heroes protect one another while solving the cave; Blue treats subordinates as expendable steps toward promotion. Their methods expose the difference between cooperation and command built entirely on fear.",
                    playerReflection: "How a leader handles danger reveals more than any stated value. Do your methods leave the people beside you stronger or merely spent?",
                    characters: ["goku", "bulma", "krillin", "general-blue", "pirate-robot"],
                    tags: ["pirate-cave", "traps", "leadership", "danger"]
                },
                {
                    id: "db_general_blue_story_03",
                    order: 3,
                    phase: "preclimax",
                    focusRatio: 0.62,
                    title: "Blue's Psychic Grip",
                    canonText: "General Blue corners the group and reveals psychic power strong enough to paralyze Goku and Krillin. As he prepares to finish Goku, a mouse startles him and breaks his concentration, allowing Goku to counterattack. The damaged cave begins collapsing, and the friends escape with only part of the treasure while Blue survives and continues after the Dragon Balls.",
                    characterText: "Blue's control seems absolute until an ordinary interruption breaks it. Goku survives because attention, like strength, can fail; Bulma and Krillin then help turn escape into the real priority.",
                    playerReflection: "A dominant threat may depend on fragile concentration or perfect conditions. Which small disruption could return choice to a situation that feels fixed?",
                    characters: ["goku", "bulma", "krillin", "general-blue"],
                    tags: ["psychic-power", "escape", "attention", "preclimax"]
                },
                {
                    id: "db_general_blue_story_04",
                    order: 4,
                    phase: "resolution",
                    title: "The Chase to Penguin Village",
                    canonText: "Blue reaches Kame House, binds the group, steals the Dragon Balls, and leaves a bomb behind. Launch returns and frees Goku, who throws the bomb away before pursuing Blue on the Flying Nimbus. The chase ends near Penguin Village, where Bulma repairs the damaged radar and local inventor Senbei helps. When Blue threatens Goku again, Arale's astonishing strength sends the general flying far away.",
                    characterText: "Goku refuses to let one loss end the pursuit, but unfamiliar allies make recovery possible. Launch acts instantly, Bulma restores the search, and Arale resolves a threat without sharing its grim assumptions.",
                    playerReflection: "Recovery is often distributed across several people, not performed by one hero. Who helps you survive, regain direction, and act again?",
                    characters: ["goku", "bulma", "krillin", "general-blue", "launch", "arale", "senbei"],
                    tags: ["penguin-village", "dragon-radar", "arale", "resolution"]
                },
                {
                    id: "db_general_blue_story_05",
                    order: 5,
                    phase: "mastery",
                    title: "Beyond a Straight-Line Pursuit",
                    canonText: "With Blue blasted out of Penguin Village and the stolen Dragon Balls recovered, Goku can resume following the radar toward the next signal. The pirate-cave pursuit has shown that his growing strength is only one part of success: technology, quick rescues, local knowledge, and comic unpredictability repeatedly prevent General Blue's ruthless efficiency from becoming final victory.",
                    characterText: "Bulma remains essential because she can restore the tool guiding Goku's journey. Goku's persistence matters most when it stays open to help from people whose talents look nothing like his own.",
                    playerReflection: "Mastery is not forcing every problem into your strongest method. It is keeping the mission alive while many different kinds of help do their work.",
                    characters: ["goku", "bulma", "general-blue", "arale", "senbei"],
                    tags: ["recovery", "diverse-strengths", "dragon-balls", "mastery"]
                }
            ]
        },

        db_commander_red: {
            id: "db_commander_red",
            title: "Mercenary Tao and Commander Red",
            series: "DB",
            continuity: "canon_core",
            sourceNote: "Dragon Ball manga chapters 84-96 (Mercenary Tao, Korin Tower, and Red Ribbon headquarters); anime episodes 58-67. The later search for Baba is excluded.",
            sourceScope: { mangaChapters: "84-96", animeEpisodes: "58-67" },
            entries: [
                {
                    id: "db_commander_red_story_01",
                    order: 1,
                    phase: "entry",
                    focusRatio: 0,
                    title: "The Assassin at Korin",
                    canonText: "After General Blue returns empty-handed, Commander Red has Mercenary Tao kill him and hires the assassin to stop Goku. At the base of Korin Tower, Bora refuses to surrender a Dragon Ball he guards for his land. Tao kills Bora, then overwhelms Goku with effortless speed and a Dodon Ray. The four-star ball over Goku's heart keeps the blast from killing him.",
                    characterText: "Tao turns skill into a commercial weapon and treats resistance as an invoice. Bora stands firm without illusion about the danger, and Goku meets an opponent far beyond his current preparation.",
                    playerReflection: "A serious defeat is information, not a verdict. Can you study the gap clearly enough to change your preparation before seeking another attempt?",
                    characters: ["goku", "mercenary-tao", "bora", "upa", "commander-red", "general-blue"],
                    tags: ["mercenary-tao", "bora", "defeat", "korin-tower"]
                },
                {
                    id: "db_commander_red_story_02",
                    order: 2,
                    phase: "development",
                    focusRatio: 0.3,
                    title: "Three Days with Korin",
                    canonText: "Determined to defeat Tao and restore Bora someday, Goku climbs Korin Tower and meets the ancient master Korin. The promised Sacred Water is ordinary; the real training is trying to take it from a teacher who reads every move. In three days, Goku learns economy, prediction, and movement that once took Roshi years to develop, then descends transformed by practice rather than a magical drink.",
                    characterText: "Korin lets Goku chase a simple prize until he recognizes the lesson hidden inside the chase. Goku improves quickly because he trains with total attention instead of defending his pride.",
                    playerReflection: "The object you want may be less important than the skill required to earn it. What process is quietly becoming the real reward?",
                    characters: ["goku", "korin", "upa", "mercenary-tao"],
                    tags: ["korin", "training", "sacred-water", "adaptation"]
                },
                {
                    id: "db_commander_red_story_03",
                    order: 3,
                    phase: "preclimax",
                    focusRatio: 0.62,
                    title: "The Rematch",
                    canonText: "Tao returns after replacing his damaged clothes and finds that Goku can now read and counter him. The assassin's weapons and techniques fail, including the Dodon Ray that once ended the fight instantly. Facing defeat, Tao throws a grenade and pretends to surrender. Goku kicks the grenade back, and Tao is caught by the treachery he intended for his opponent.",
                    characterText: "Goku's improvement is technical and moral: he becomes harder to fool without adopting Tao's cruelty. Tao cannot adapt because deceit remains his answer even after superior force fails.",
                    playerReflection: "Growth should sharpen judgment as well as performance. What warning sign will help you recognize when an opponent's apparent surrender is only another tactic?",
                    characters: ["goku", "mercenary-tao", "upa"],
                    tags: ["rematch", "dodon-ray", "discernment", "preclimax"]
                },
                {
                    id: "db_commander_red_story_04",
                    order: 4,
                    phase: "resolution",
                    title: "The Fall of Red Ribbon Headquarters",
                    canonText: "Goku attacks Red Ribbon headquarters alone and advances so rapidly that much of the army abandons its posts. Staff Officer Black discovers Commander Red intended to use the Dragon Balls only to become taller and kills him in disgust. Black offers Goku a place beside him, then attacks in a battle jacket when refused. Goku destroys the machine and ends the army's central command.",
                    characterText: "Red's private vanity exposes the emptiness beneath the army's global violence. Black rejects that motive but not the hunger for control, while Goku refuses both versions without needing power for himself.",
                    playerReflection: "An organization built on a hidden selfish goal eventually spends people for nothing. Which stated mission deserves a closer look at its actual incentives?",
                    characters: ["goku", "commander-red", "staff-officer-black"],
                    tags: ["red-ribbon-headquarters", "commander-red", "staff-officer-black", "resolution"]
                },
                {
                    id: "db_commander_red_story_05",
                    order: 5,
                    phase: "mastery",
                    title: "Six Dragon Balls and One Promise",
                    canonText: "Bulma, Roshi, Krillin, Yamcha, and the others arrive expecting to rescue Goku, only to find the Red Ribbon Army already defeated. Goku now holds six Dragon Balls, but the radar cannot detect the seventh. He has ended the force pursuing him, yet his real purpose remains unchanged: find the missing ball and ask Shenron to restore Bora for Upa.",
                    characterText: "Goku's friends measure the scale of what he accomplished, but he does not treat destroying the army as the destination. Loyalty to Upa keeps victory attached to a specific unfinished promise.",
                    playerReflection: "Mastery keeps a dramatic achievement from replacing the reason you began. After a major win, what promise still determines the next step?",
                    characters: ["goku", "upa", "bulma", "master-roshi", "krillin", "yamcha"],
                    tags: ["red-ribbon-army", "six-dragon-balls", "promise", "mastery"]
                }
            ]
        },

        db_baba: {
            id: "db_baba",
            title: "Fortuneteller Baba's Warriors",
            series: "DB",
            continuity: "canon_core",
            sourceNote: "Dragon Ball manga chapters 97-112 (Baba's five warriors and the final Dragon Ball); anime episodes 68-83.",
            sourceScope: { mangaChapters: "97-112", animeEpisodes: "68-83" },
            entries: [
                {
                    id: "db_baba_story_01",
                    order: 1,
                    phase: "entry",
                    focusRatio: 0,
                    title: "The Ball the Radar Cannot Find",
                    canonText: "With six Dragon Balls assembled, Bulma's radar still shows no trace of the last one. Master Roshi sends Goku, Krillin, Yamcha, Puar, and Upa to his sister, Fortuneteller Baba, who can locate anything. Her fee is beyond them, but she offers another price: defeat five supernatural fighters in her arena, and she will tell them where the missing ball is.",
                    characterText: "Upa's hope gives the contest weight beyond prize money or reputation. Baba turns information into a test, while the group accepts because ordinary technology has reached its limit.",
                    playerReflection: "When a trusted method reaches its limit, progress may require a different kind of expert. Are you treating one tool's silence as the end?",
                    characters: ["goku", "krillin", "yamcha", "puar", "upa", "fortuneteller-baba", "master-roshi"],
                    tags: ["fortuneteller-baba", "missing-dragon-ball", "challenge", "new-method"]
                },
                {
                    id: "db_baba_story_02",
                    order: 2,
                    phase: "development",
                    focusRatio: 0.14,
                    title: "Fangs in the Devil's Toilet",
                    canonText: "Krillin opens the contest against Fangs the Vampire and is quickly defeated. Upa and Puar combine their shapeshifting to exploit the vampire's weaknesses, turning into garlic and a cross before knocking him into the poisonous arena below. The smallest members of the group earn the first victory through preparation and coordination rather than matching their opponent's strength.",
                    characterText: "Krillin's loss does not end the team's chance. Upa brings courage despite grief, and Puar turns flexible support into the precise answer required for an unusual enemy.",
                    playerReflection: "A setback by the obvious contender can create space for a better combination. Which two modest strengths become decisive when deliberately paired?",
                    characters: ["krillin", "upa", "puar", "fangs-the-vampire"],
                    tags: ["vampire", "shapeshifting", "coordination", "underdogs"]
                },
                {
                    id: "db_baba_story_03",
                    order: 3,
                    phase: "development",
                    focusRatio: 0.3,
                    title: "Enemies Seen and Unseen",
                    canonText: "Yamcha faces the Invisible Man and struggles to strike what he cannot see. Krillin devises an outrageous distraction that covers the invisible fighter in blood, making him targetable. Yamcha wins, but Baba's next warrior, Bandages the Mummy, is far stronger and defeats him. The team has solved one kind of uncertainty only to meet a straightforward gap in power.",
                    characterText: "Yamcha trusts Krillin's improvised solution and converts visibility into victory. His next loss is equally useful evidence: clever positioning cannot always compensate for a large physical disadvantage.",
                    playerReflection: "Different failures need different diagnoses. Is your current obstacle hidden information, weak execution, or a genuine capacity gap requiring more training?",
                    characters: ["yamcha", "krillin", "invisible-man", "bandages-the-mummy"],
                    tags: ["invisible-man", "mummy", "improvisation", "diagnosis"]
                },
                {
                    id: "db_baba_story_04",
                    order: 4,
                    phase: "development",
                    focusRatio: 0.48,
                    title: "A Heart Without Evil",
                    canonText: "Goku easily defeats Bandages and then faces Spike the Devil Man. Spike's Devilmite Beam expands any evil within a target until the target is destroyed, a technique that has ended opponents stronger than he is. It has no effect on Goku because there is no malicious impulse for it to magnify. Goku wins, leaving only Baba's masked final fighter.",
                    characterText: "Goku's advantage is not a new attack but the absence of hatred Spike expects everyone to carry. Innocence becomes practical resilience without making Goku passive or unable to fight.",
                    playerReflection: "Some attacks gain leverage from what you carry inside. What resentment would lose power over you if you stopped feeding it?",
                    characters: ["goku", "bandages-the-mummy", "spike-the-devil-man"],
                    tags: ["devilmite-beam", "pure-heart", "resilience", "character"]
                },
                {
                    id: "db_baba_story_05",
                    order: 5,
                    phase: "preclimax",
                    focusRatio: 0.7,
                    title: "The Masked Fighter",
                    canonText: "Baba's fifth warrior fights Goku with intimate knowledge of his habits and tail. During the match, the mask comes away and reveals Grandpa Gohan, permitted to return from the afterlife for one day. Their contest becomes a joyful reunion rather than a grudge. Gohan is satisfied by Goku's growth, then yields and returns after giving his grandson a final embrace.",
                    characterText: "Goku's strength cannot contain his emotion when he recognizes the guardian he thought was gone forever. Gohan tests him lovingly, finding the adventurous child still grounded in affection.",
                    playerReflection: "Progress feels different when measured against someone who shaped your beginning. Whose standards still help you recognize the person you are becoming?",
                    characters: ["goku", "grandpa-gohan", "fortuneteller-baba"],
                    tags: ["grandpa-gohan", "reunion", "afterlife", "preclimax"]
                },
                {
                    id: "db_baba_story_06",
                    order: 6,
                    phase: "resolution",
                    title: "The Final Ball and Bora's Return",
                    canonText: "Baba locates the last Dragon Ball inside a box that blocks Bulma's radar. Pilaf, Shu, and Mai possess it and challenge Goku in machines designed to exploit his tail, but he defeats them and completes the set. At the base of Korin Tower, Shenron answers Goku's wish and restores Bora to life, reuniting Upa with his father.",
                    characterText: "Goku uses the world's greatest wish for the promise he made to one grieving child. Upa's patience ends not with abstract victory, but with Bora standing beside him again.",
                    playerReflection: "A clear purpose protects powerful rewards from becoming distractions. If your hardest effort succeeds, who or what should benefit first?",
                    characters: ["goku", "upa", "bora", "emperor-pilaf", "shu", "mai", "shenron"],
                    tags: ["final-dragon-ball", "shenron", "resurrection", "resolution"]
                },
                {
                    id: "db_baba_story_07",
                    order: 7,
                    phase: "mastery",
                    title: "A Journey Without the Nimbus",
                    canonText: "With Bora restored and the Dragon Balls scattered again, Goku's second quest has reached its true destination. Master Roshi tells him to travel the world and train for the next tournament without relying on the Flying Nimbus. Goku sets out on foot, carrying the lessons of friendship, grief, and follow-through into years of self-directed practice rather than chasing another immediate reward.",
                    characterText: "Roshi removes a convenience so the journey itself can train Goku. Goku accepts a quieter challenge after proving he can defeat armies and supernatural fighters for someone else's sake.",
                    playerReflection: "Mastery sometimes means surrendering the shortcut that your current ability has outgrown. Which convenience is now insulating you from useful effort?",
                    characters: ["goku", "master-roshi", "upa", "bora"],
                    tags: ["world-training", "follow-through", "journey", "mastery"]
                }
            ]
        },

        db_tien: {
            id: "db_tien",
            title: "The 22nd World Martial Arts Tournament",
            series: "DB",
            continuity: "canon_core",
            sourceNote: "Dragon Ball manga chapters 113-134 (the 22nd Tenkaichi Budokai and Tien's break with the Crane School); anime episodes 84-101.",
            sourceScope: { mangaChapters: "113-134", animeEpisodes: "84-101" },
            entries: [
                {
                    id: "db_tien_story_01",
                    order: 1,
                    phase: "entry",
                    focusRatio: 0,
                    title: "Rival Schools Reunite",
                    canonText: "Three years after the last tournament, Goku returns taller, faster, and hardened by solitary travel. He reunites with Krillin, Yamcha, Roshi, and their friends at the 22nd World Martial Arts Tournament. Tien Shinhan and Chiaotzu arrive representing Master Shen's Crane School, treating the Turtle students as enemies in an old rivalry between their teachers.",
                    characterText: "Goku's warm reunion contrasts with Tien's practiced contempt. Tien has discipline and exceptional talent, but his teacher has tied both to superiority, cruelty, and loyalty to a grievance he did not create.",
                    playerReflection: "Inherited rivalry can make strangers feel like enemies before evidence arrives. Which conflict are you carrying mainly because someone else taught it to you?",
                    characters: ["goku", "krillin", "yamcha", "master-roshi", "tien-shinhan", "chiaotzu", "master-shen"],
                    tags: ["22nd-tournament", "crane-school", "reunion", "rivalry"]
                },
                {
                    id: "db_tien_story_02",
                    order: 2,
                    phase: "development",
                    focusRatio: 0.14,
                    title: "The Bracket Takes Shape",
                    canonText: "The leading Turtle and Crane fighters pass the preliminaries with ease. Chiaotzu uses telekinesis to arrange the drawing so each school's strongest competitors will collide in the final rounds. Tien expects the bracket to demonstrate Crane superiority, while Goku welcomes the chance to test three years of training. The tournament becomes both competition and an argument about what martial arts should produce.",
                    characterText: "Chiaotzu quietly bends the structure for Tien, showing loyalty expressed as interference. Goku needs no favorable path; he treats strong opponents as the point of entering rather than a threat to status.",
                    playerReflection: "An engineered advantage can protect a result while weakening its meaning. Would you still value the win if you secretly controlled the conditions?",
                    characters: ["goku", "krillin", "yamcha", "tien-shinhan", "chiaotzu"],
                    tags: ["bracket", "telekinesis", "competition", "integrity"]
                },
                {
                    id: "db_tien_story_03",
                    order: 3,
                    phase: "development",
                    focusRatio: 0.3,
                    title: "Yamcha's Broken Leg",
                    canonText: "Yamcha fights Tien in a fierce quarterfinal and proves far stronger than the Crane students expected. Tien still wins, then deliberately breaks Yamcha's leg after the outcome is settled. Roshi condemns the needless cruelty, and Goku's friendly competitiveness hardens into resolve. Tien has secured advancement, but his choice makes the moral weakness of his training impossible to ignore.",
                    characterText: "Yamcha earns respect through improvement even while losing. Tien adds harm to victory because Master Shen taught him dominance requires humiliation, yet the disapproval around him begins to reach past that conditioning.",
                    playerReflection: "What you do after gaining control reveals your character. Where could restraint demonstrate more confidence than extracting one final advantage?",
                    characters: ["yamcha", "tien-shinhan", "goku", "master-roshi"],
                    tags: ["yamcha", "tien-shinhan", "cruelty", "restraint"]
                },
                {
                    id: "db_tien_story_04",
                    order: 4,
                    phase: "development",
                    focusRatio: 0.48,
                    title: "Roshi Steps Aside",
                    canonText: "Competing again as Jackie Chun, Roshi faces Tien and tests both his technique and his motives. Roshi recognizes that Tien is not beyond change and forfeits after making his point, refusing to let the old masters' feud define the younger fighter. He tells Tien that the Turtle School offers a different path, leaving him unsettled by respect he was prepared to answer with hostility.",
                    characterText: "Roshi gives up a tournament result to influence the person behind the opponent. Tien encounters authority without manipulation, and that contrast begins loosening Master Shen's claim over his identity.",
                    playerReflection: "Sometimes the strategic win is not the official result. What could you release if doing so made the deeper lesson impossible to dismiss?",
                    characters: ["master-roshi", "tien-shinhan", "master-shen"],
                    tags: ["jackie-chun", "forfeit", "mentorship", "change"]
                },
                {
                    id: "db_tien_story_05",
                    order: 5,
                    phase: "preclimax",
                    focusRatio: 0.7,
                    title: "The Finalists Emerge",
                    canonText: "Krillin defeats Chiaotzu by exploiting his difficulty with basic arithmetic, but later loses a close semifinal to Goku. Tien advances to meet Goku, carrying growing doubts about the Crane School's methods. Both finalists possess unfamiliar techniques and the ability to adapt quickly. The coming match will test more than power: Tien must decide whether he is Master Shen's weapon or his own martial artist.",
                    characterText: "Krillin again turns observation into an advantage and pushes Goku hard enough to show their shared progress. Tien reaches the final while his old definition of victory is beginning to fracture.",
                    playerReflection: "A final test often arrives while your reasons are changing. Before the pressure peaks, can you state whose standard you are actually trying to meet?",
                    characters: ["goku", "krillin", "tien-shinhan", "chiaotzu", "master-shen"],
                    tags: ["semifinals", "arithmetic", "identity", "preclimax"]
                },
                {
                    id: "db_tien_story_06",
                    order: 6,
                    phase: "resolution",
                    title: "A Victory by Inches",
                    canonText: "Goku and Tien trade speed, technique, and invention through an even final. When Master Shen orders Chiaotzu to freeze Goku with telekinesis, Tien recognizes the interference and rejects his teacher, insisting on a fair fight. He destroys the ring, and both fighters fall toward the ground. Goku strikes a passing vehicle first, so Tien lands moments later and wins by the narrowest accident.",
                    characterText: "Tien's decisive victory occurs before the count: he chooses integrity over obedience when cheating would guarantee the title. Goku accepts the unlucky result because the honest contest mattered more than possession of the prize.",
                    playerReflection: "A result shaped by chance can still contain a deliberate moral win. Which choice would make you respect your performance regardless of the score?",
                    characters: ["goku", "tien-shinhan", "chiaotzu", "master-shen"],
                    tags: ["finals", "fair-fight", "crane-school", "resolution"]
                },
                {
                    id: "db_tien_story_07",
                    order: 7,
                    phase: "mastery",
                    title: "The Path Tien Chooses",
                    canonText: "After the final, Tien apologizes for his earlier cruelty and offers Goku part of the prize money, which Goku declines. Tien and Chiaotzu leave Master Shen's control and begin relating to the Turtle fighters as peers rather than assigned enemies. The tournament's lasting achievement is not Tien's technical title, but his decision that martial skill will no longer excuse dishonorable conduct.",
                    characterText: "Tien does not erase his actions by changing sides; he begins with accountability and a different standard. Chiaotzu follows his closest friend away from the teacher who used both of them.",
                    playerReflection: "Mastery includes revising the code beneath your skill. What apology or changed behavior would make your next success cleaner than the last?",
                    characters: ["tien-shinhan", "chiaotzu", "goku", "yamcha", "master-roshi"],
                    tags: ["accountability", "new-path", "integrity", "mastery"]
                }
            ]
        },

        db_king_piccolo: {
            id: "db_king_piccolo",
            title: "King Piccolo",
            series: "DB",
            continuity: "canon_core",
            sourceNote: "Dragon Ball manga chapters 135-161 (King Piccolo's return, conquest, and defeat); anime episodes 102-122.",
            sourceScope: { mangaChapters: "135-161", animeEpisodes: "102-122" },
            entries: [
                {
                    id: "db_king_piccolo_story_01",
                    order: 1,
                    phase: "entry",
                    focusRatio: 0,
                    title: "Krillin's Murder",
                    canonText: "Moments after the tournament, Goku finds Krillin murdered beside an empty place where the four-star Dragon Ball and participant roster had been. Ignoring Roshi's warning and his own exhaustion, Goku takes the Flying Nimbus after the killer, Tambourine. The celebration collapses into grief, and the stolen roster suggests the attack is aimed at martial artists rather than at Krillin alone.",
                    characterText: "Goku's response is immediate and personal; grief overwhelms the patience he learned in competition. Roshi recognizes an older danger in the demon's mark and understands that anger is sending Goku toward it unprepared.",
                    playerReflection: "Urgency can be real while your condition is still poor. In a painful moment, what must happen before action becomes effective rather than merely immediate?",
                    characters: ["goku", "krillin", "tambourine", "master-roshi"],
                    tags: ["krillin", "tambourine", "grief", "pursuit"]
                },
                {
                    id: "db_king_piccolo_story_02",
                    order: 2,
                    phase: "development",
                    focusRatio: 0.12,
                    title: "The Demon King's List",
                    canonText: "Exhausted and furious, Goku catches Tambourine but is defeated and left for dead. Tambourine continues killing former tournament competitors from the stolen roster. The campaign comes from King Piccolo, an ancient demon released by Pilaf, who fears that a skilled martial artist might repeat the technique that once sealed him away. Terror spreads through the very community the tournaments assembled.",
                    characterText: "King Piccolo attacks future resistance before it can organize, turning a public list of achievement into a targeting tool. Goku's defeat shows the cost of entering that strategy on emotion alone.",
                    playerReflection: "Systems built for recognition can also expose people to danger. What information about your team should be protected when circumstances change?",
                    characters: ["goku", "tambourine", "king-piccolo", "emperor-pilaf"],
                    tags: ["king-piccolo", "martial-artists", "targeting", "defeat"]
                },
                {
                    id: "db_king_piccolo_story_03",
                    order: 3,
                    phase: "development",
                    focusRatio: 0.24,
                    title: "Yajirobe and Cymbal",
                    canonText: "Goku awakens hungry and meets Yajirobe, a wary swordsman carrying a Dragon Ball. Their argument is interrupted by Cymbal, another of Piccolo's offspring, sent to collect it. Yajirobe kills Cymbal with his sword and cooks the demon for food. Though reluctant to join anyone's cause, he gives Goku a meal and becomes entangled in a conflict he would rather avoid.",
                    characterText: "Yajirobe is strong, practical, and openly self-interested, unlike the formal martial artists Piccolo expects. Goku's first recovery comes through food and an accidental ally rather than solitary resolve.",
                    playerReflection: "Useful allies do not always share your style or enthusiasm. Can you recognize dependable action even when it arrives wrapped in reluctance?",
                    characters: ["goku", "yajirobe", "cymbal", "king-piccolo"],
                    tags: ["yajirobe", "cymbal", "dragon-ball", "unlikely-ally"]
                },
                {
                    id: "db_king_piccolo_story_04",
                    order: 4,
                    phase: "development",
                    focusRatio: 0.36,
                    title: "Tambourine Avenged",
                    canonText: "Restored by food, Goku defeats Tambourine when the demon returns, avenging Krillin but not ending the larger threat. King Piccolo then confronts Goku personally and overwhelms him, stopping his heart long enough to assume he is dead. Yajirobe survives by hiding. The gap between Piccolo and his offspring makes clear that one revenge victory has not solved the crisis.",
                    characterText: "Goku converts grief into a focused rematch and wins, then immediately meets a far greater scale of danger. Yajirobe's instinct to survive preserves the only person nearby who can still help him.",
                    playerReflection: "Completing one emotional objective can hide the larger problem behind it. After a hard-won response, what threat still remains structurally untouched?",
                    characters: ["goku", "tambourine", "king-piccolo", "yajirobe"],
                    tags: ["tambourine", "revenge", "king-piccolo", "scale"]
                },
                {
                    id: "db_king_piccolo_story_05",
                    order: 5,
                    phase: "development",
                    focusRatio: 0.48,
                    title: "A Wish Bought with Lives",
                    canonText: "Roshi, Tien, and Chiaotzu race to gather the Dragon Balls before Piccolo. Roshi attempts the Mafuba, the life-consuming technique once used to seal the demon, but misses and dies. Chiaotzu tries to make a wish first and is killed. Piccolo asks Shenron for restored youth, receives it, then destroys the dragon so no one can reverse his gains.",
                    characterText: "Roshi knowingly risks his life on the only method he trusts, and Chiaotzu acts despite terror when the opening appears. Piccolo turns their failed courage into greater power and apparent permanence.",
                    playerReflection: "Courage does not guarantee success, but failure can still preserve knowledge for the next attempt. What must survive even if your own plan does not?",
                    characters: ["master-roshi", "tien-shinhan", "chiaotzu", "king-piccolo", "shenron"],
                    tags: ["mafuba", "shenron", "sacrifice", "youth"]
                },
                {
                    id: "db_king_piccolo_story_06",
                    order: 6,
                    phase: "development",
                    focusRatio: 0.62,
                    title: "The King's Castle",
                    canonText: "Young again, King Piccolo seizes the world's royal castle and forces the King to announce his rule. He plans to destroy one region each year, beginning immediately, so fear will structure ordinary life. Meanwhile Yajirobe carries the barely living Goku up Korin Tower. With no conventional training time left, Goku drinks the dangerous Ultra Divine Water and survives its poison, awakening greater power.",
                    characterText: "Piccolo converts random destruction into government by dread. Yajirobe complains through an exhausting rescue but completes it, while Goku accepts a lethal risk only after every safer path has closed.",
                    playerReflection: "Extreme measures are justified by constraints, not excitement. Have you verified that the safer paths are truly closed before choosing the dangerous shortcut?",
                    characters: ["king-piccolo", "king-furry", "goku", "yajirobe", "korin"],
                    tags: ["world-conquest", "ultra-divine-water", "risk", "rescue"]
                },
                {
                    id: "db_king_piccolo_story_07",
                    order: 7,
                    phase: "preclimax",
                    focusRatio: 0.78,
                    title: "Tien's Last Stand",
                    canonText: "Tien masters the Mafuba and reaches the royal castle, but the container he needs is damaged before he can use it. Piccolo creates Drum to kill him, and Tien is outmatched. Goku arrives, defeats Drum with a single blow, and challenges the Demon King. The rescue restores hope, yet Goku must still overcome an opponent who has already beaten him twice.",
                    characterText: "Tien advances despite Roshi's death and a broken plan, proving how completely he has left the assassin's path. Goku returns with controlled power rather than the exhausted rage of his first pursuit.",
                    playerReflection: "A failed tool does not erase the courage that brought you to the crisis. When the plan breaks, how can your presence still create an opening?",
                    characters: ["tien-shinhan", "king-piccolo", "drum", "goku"],
                    tags: ["tien-shinhan", "drum", "mafuba", "preclimax"]
                },
                {
                    id: "db_king_piccolo_story_08",
                    order: 8,
                    phase: "resolution",
                    title: "Through the Demon King",
                    canonText: "Goku's new strength lets him contend with King Piccolo, but the demon cripples his limbs and uses Tien as a hostage. With one arm still working, Goku launches himself upward and drives through Piccolo's body. Before dying, Piccolo expels an egg containing his offspring and reincarnation, entrusting it with revenge. The tyrant falls, though the danger is not completely gone.",
                    characterText: "Goku wins by concentrating everything remaining into one possible action. Piccolo answers defeat by extending his hatred into a successor, preserving a future conflict even as his rule ends.",
                    playerReflection: "Resolution can be decisive without being complete. After stopping the immediate threat, what seed of the same problem still needs patient attention?",
                    characters: ["goku", "king-piccolo", "tien-shinhan", "piccolo-jr"],
                    tags: ["final-battle", "piccolo-jr", "victory", "resolution"]
                },
                {
                    id: "db_king_piccolo_story_09",
                    order: 9,
                    phase: "mastery",
                    title: "Victory, Grief, and a Hidden Heir",
                    canonText: "Yajirobe catches Goku before he falls and carries his badly injured friend toward safety. Tien confirms that Roshi, Chiaotzu, and Shenron are dead, then asks Goku to recover and train for another tournament. Bulma relays news of Piccolo's defeat to the world. Elsewhere, the demon's final egg hatches, leaving the new peace real but vulnerable.",
                    characterText: "Goku allows rescue after spending everything he had, and Tien answers shared grief with a future promise. The newborn Piccolo shows that victory deserves neither denial nor careless certainty.",
                    playerReflection: "Mastery can honor a decisive win while acknowledging its costs and unfinished risks. What needs recovery before preparation for the next challenge begins?",
                    characters: ["goku", "yajirobe", "tien-shinhan", "bulma", "piccolo-jr"],
                    tags: ["aftermath", "recovery", "piccolo-jr", "mastery"]
                }
            ]
        },

        db_piccolo_jr: {
            id: "db_piccolo_jr",
            title: "The 23rd World Martial Arts Tournament",
            series: "DB",
            continuity: "canon_core",
            sourceNote: "Dragon Ball manga chapters 162-194 (the 23rd Tenkaichi Budokai and Piccolo Junior); anime episodes 123-148 adapt the core tournament, while the anime-only wedding detour in episodes 149-153 is excluded.",
            sourceScope: { mangaChapters: "162-194", animeCoreEpisodes: "123-148", excludedAnimeEpisodes: "149-153" },
            entries: [
                {
                    id: "db_piccolo_jr_story_01",
                    order: 1,
                    phase: "entry",
                    focusRatio: 0,
                    title: "Training Above the World",
                    canonText: "After healing, Goku uses the Power Pole to reach Kami's Lookout and learns from Mr. Popo and Kami. Kami restores Shenron, allowing Krillin, Roshi, Chiaotzu, and Piccolo's other victims to return, while Goku stays for three years of training. He then arrives grown at the 23rd World Martial Arts Tournament, where Piccolo Junior and an angry anonymous woman also enter.",
                    characterText: "Goku turns victory into restoration and deeper preparation. His changed appearance makes hidden work visible, while Piccolo and the unknown woman bring inherited revenge and a forgotten promise into the same bracket.",
                    playerReflection: "Long growth can make others reassess you, but unfinished commitments still recognize the person underneath. What promise has matured while you were busy improving?",
                    characters: ["goku", "kami", "mr-popo", "shenron", "krillin", "master-roshi", "chiaotzu", "piccolo-jr", "chi-chi"],
                    tags: ["kami-lookout", "revival", "23rd-tournament", "unfinished-promises"]
                },
                {
                    id: "db_piccolo_jr_story_02",
                    order: 2,
                    phase: "development",
                    focusRatio: 0.12,
                    title: "The Cyborg Assassin Returns",
                    canonText: "The strongest entrants pass the preliminaries, including a reconstructed Mercenary Tao. Tao targets Tien, furious that the Crane School's former star rejected the assassin's path. In their quarterfinal, Tien withstands hidden blades and a surprise attack, then defeats his old model without killing him. The result confirms that Tien's ethical change has not weakened his martial skill.",
                    characterText: "Tao returns with mechanical upgrades but the same dependence on treachery. Tien answers with composure and restraint, proving that leaving a corrupt teacher can improve both judgment and performance.",
                    playerReflection: "Old influences often return to test whether a change was durable. What boundary would demonstrate that you no longer need your former pattern?",
                    characters: ["tien-shinhan", "mercenary-tao", "master-shen"],
                    tags: ["cyborg-tao", "tien-shinhan", "quarterfinal", "growth"]
                },
                {
                    id: "db_piccolo_jr_story_03",
                    order: 3,
                    phase: "development",
                    focusRatio: 0.24,
                    title: "Chi-Chi's Promise",
                    canonText: "Goku faces the anonymous woman, who promises to explain her anger if he wins. After Goku knocks her from the ring with the force of a punch, she reveals herself as Chi-Chi. Years earlier at Fire Mountain, he promised to marry her without knowing what marriage meant. Once he remembers and learns the meaning, Goku openly agrees to keep that promise.",
                    characterText: "Chi-Chi enters the tournament to demand accountability in the language Goku understands best. Goku does not hide behind childhood ignorance; once the promise is clear, he accepts it directly.",
                    playerReflection: "Not understanding an old commitment explains neglect but does not resolve it. Which forgotten promise needs a clear answer now that you know its weight?",
                    characters: ["goku", "chi-chi"],
                    tags: ["chi-chi", "marriage-promise", "accountability", "quarterfinal"]
                },
                {
                    id: "db_piccolo_jr_story_04",
                    order: 4,
                    phase: "development",
                    focusRatio: 0.36,
                    title: "Krillin Faces Piccolo",
                    canonText: "Krillin draws Piccolo Junior in the quarterfinal and refuses to surrender despite sensing the danger. He surprises Piccolo with his speed, tactics, and ability to remain airborne, forcing the demon to reveal more power than expected. Krillin ultimately concedes when the gap becomes decisive. His performance warns Piccolo that Goku's allies are no longer incidental obstacles.",
                    characterText: "Krillin measures courage with judgment: he pushes far enough to learn and challenge, then stops before sacrifice becomes empty. Piccolo leaves with less certainty about the opposition he inherited.",
                    playerReflection: "A disciplined withdrawal can preserve the value of a brave attempt. How will you recognize the point where further risk stops producing useful information?",
                    characters: ["krillin", "piccolo-jr"],
                    tags: ["krillin", "piccolo-jr", "aerial-combat", "judgment"]
                },
                {
                    id: "db_piccolo_jr_story_05",
                    order: 5,
                    phase: "development",
                    focusRatio: 0.48,
                    title: "Kami Enters the Ring",
                    canonText: "Yamcha faces an awkward-seeming man called Hero, who is actually Kami using a human body so he can confront Piccolo without exposing his identity. Kami's unfamiliar movement disguises divine skill, and he defeats Yamcha. Piccolo recognizes him, revealing that their lives remain linked: killing Piccolo would also kill Kami and permanently remove Earth's Dragon Balls.",
                    characterText: "Kami tries to solve his ancient mistake personally, but secrecy limits the allies who might question his plan. Yamcha loses to an opponent whose harmless appearance conceals an entirely different level of purpose.",
                    playerReflection: "Private responsibility can become isolation. Which burden would benefit from trusted scrutiny before you attempt a solution that cannot be reversed?",
                    characters: ["yamcha", "kami", "piccolo-jr"],
                    tags: ["kami", "hero", "life-link", "secrecy"]
                },
                {
                    id: "db_piccolo_jr_story_06",
                    order: 6,
                    phase: "development",
                    focusRatio: 0.62,
                    title: "The Final Is Set",
                    canonText: "Goku defeats Tien in a semifinal shaped by afterimages, extra arms, divided bodies, and constant adaptation. In the other semifinal, Kami attempts the Mafuba on Piccolo, but Piccolo reverses the technique and seals Kami inside the small container he carried. Piccolo swallows it, preventing Goku from attacking freely, and advances to the final with their shared life still at stake.",
                    characterText: "Goku and Tien compete without hatred, each improvement inviting another. Kami's solitary plan fails against inherited knowledge, leaving Goku to solve a conflict where simply destroying the opponent would deepen the loss.",
                    playerReflection: "The obvious winning move can be unusable when systems are linked. What consequence must your solution preserve, not merely what obstacle must it remove?",
                    characters: ["goku", "tien-shinhan", "kami", "piccolo-jr"],
                    tags: ["semifinals", "mafuba", "linked-consequences", "adaptation"]
                },
                {
                    id: "db_piccolo_jr_story_07",
                    order: 7,
                    phase: "preclimax",
                    focusRatio: 0.78,
                    title: "The Arena Becomes a Battlefield",
                    canonText: "In the final, Piccolo enlarges himself, and Goku deliberately provokes an even greater size so he can enter the demon's mouth and rescue the container holding Kami. With that constraint removed, their fight escalates until Piccolo destroys the tournament arena and devastates the surrounding city. He cripples Goku's limbs, believing a grounded opponent can no longer prevent his victory.",
                    characterText: "Goku solves the life-link problem before pursuing the win, using Piccolo's pride as an opening. Piccolo repeatedly mistakes visible injury for the end of Goku's available choices.",
                    playerReflection: "Sequence matters: protect the irreversible dependency before taking the decisive risk. What must be secured first so later action remains recoverable?",
                    characters: ["goku", "piccolo-jr", "kami"],
                    tags: ["giant-form", "kami-rescue", "destroyed-arena", "preclimax"]
                },
                {
                    id: "db_piccolo_jr_story_08",
                    order: 8,
                    phase: "resolution",
                    title: "Champion at Last",
                    canonText: "Piccolo rises to finish the immobilized Goku, but Goku reveals the flight training he had kept hidden. He launches a final airborne headbutt that knocks Piccolo outside the ruined ring, making Goku champion of the 23rd tournament. Goku prevents Kami from killing Piccolo, then gives his fallen rival a Senzu Bean, preserving both Kami's life and the possibility of a different future.",
                    characterText: "Goku earns the title through a concealed capability rather than greater destruction. His mercy is strategic as well as compassionate: Piccolo remains dangerous, but killing him would repeat loss and erase Earth's guardian.",
                    playerReflection: "Resolution can preserve a difficult future instead of choosing an easy irreversible end. Which restrained victory creates more possibilities than total destruction?",
                    characters: ["goku", "piccolo-jr", "kami", "korin"],
                    tags: ["flight", "tournament-champion", "mercy", "resolution"]
                },
                {
                    id: "db_piccolo_jr_story_09",
                    order: 9,
                    phase: "mastery",
                    title: "Beyond the Tournament",
                    canonText: "With the tournament settled, Piccolo departs vowing to surpass Goku, and Kami offers Goku his position as Earth's guardian. Goku declines. He has fulfilled his childhood promise to Chi-Chi and leaves with her on the Flying Nimbus to begin their life together. His first tournament victory closes an era by joining strength, mercy, responsibility, and a future beyond constant competition.",
                    characterText: "Goku refuses both a divine office and a victory defined by killing his rival. Chi-Chi's long-delayed place in his future turns an old accidental promise into a chosen direction.",
                    playerReflection: "Mastery is the freedom to choose what comes after achievement. Which relationship or ordinary life commitment deserves space beside your next challenge?",
                    characters: ["goku", "chi-chi", "piccolo-jr", "kami"],
                    tags: ["marriage", "guardian", "new-era", "mastery"]
                }
            ]
        }
    });
})();
