/* Dragon Ball DAIMA and Dragon Ball Super story packs for v6.4. */
(function initializeDragonBallSuperStoryData() {
    "use strict";

    if (!globalThis.DBZ_V6_STORY_DATA) {
        globalThis.DBZ_V6_STORY_DATA = {
            version: "6.4.0",
            sagas: {},
            characters: {},
            relationships: {}
        };
    }

    const continuityTags = {
        daima_core: ["daima-core"],
        super_anime: ["super-anime", "canon-core"],
        anime_only: ["super-anime", "anime-only"],
        super_manga: ["super-manga", "canon-core"]
    };

    function makeEntries(sagaId, continuity, rows) {
        return rows.map((row, index) => {
            const [phase, focusRatio, title, canonText, characterText, playerReflection, characters, tags] = row;
            const entry = {
                id: `${sagaId}_story_${String(index + 1).padStart(2, "0")}`,
                order: index + 1,
                phase
            };
            if (focusRatio !== null) entry.focusRatio = focusRatio;
            return Object.assign(entry, {
                title,
                canonText,
                characterText,
                playerReflection,
                characters,
                tags: [...continuityTags[continuity], ...tags]
            });
        });
    }

    Object.assign(globalThis.DBZ_V6_STORY_DATA.sagas, {
        daima_demon: {
            id: "daima_demon",
            title: "The Demon Realm Conspiracy",
            series: "DAIMA",
            continuity: "daima_core",
            sourceNote: "Dragon Ball DAIMA episodes 1-7, covering Gomah's wish, the journey into the Third Demon World, and the approach to Tamagami Number Three.",
            sourceScope: { animeEpisodes: "1-7", boundary: "Ends before Goku's Tamagami Number Three battle in episode 8." },
            entries: makeEntries("daima_demon", "daima_core", [
                [
                    "entry", 0, "A Throne Claimed in Fear",
                    "After Dabura's death, Gomah becomes ruler of the Demon Realm and watches records of Majin Buu's defeat with his aide Degesu. Alarmed by the strength of Goku and his allies, they recruit the ancient Namekian Neva and travel to Earth. Their plan is preventive rather than brave: weaken distant warriors before those warriors ever consider challenging Gomah's new throne.",
                    "Gomah reads unfamiliar power as a personal threat and turns authority into preemptive control. Degesu enables the scheme, while Neva cooperates from a more ambiguous mixture of survival and hidden judgment.",
                    "Fear can make prevention look like leadership. Which risk are you controlling because it is real, and which because uncertainty bruises your status?",
                    ["gomah", "degesu", "neva", "goku"], ["demon-realm", "conspiracy", "leadership", "fear"]
                ],
                [
                    "development", 0.14, "Shenron's Unwanted Gift",
                    "Neva restores Earth's inactive Dragon Balls, allowing Gomah to summon Shenron. Gomah wishes for those who fought Majin Buu, along with their close companions, to become children; the youngest become babies. He and Degesu also take the now-infant Dende to the Demon Realm. Goku's group awakens smaller and disoriented, but their memories, loyalties, and hard-earned abilities remain.",
                    "Gomah confuses physical size with the whole of a person. Goku reacts with curiosity sooner than panic, while Piccolo and Bulma begin testing what changed instead of assuming everything was lost.",
                    "A setback may alter your tools without erasing your experience. What capability remains available after the obvious advantages have been stripped away?",
                    ["gomah", "degesu", "neva", "shenron", "goku", "dende"], ["shenron", "mini-forms", "dende", "adaptation"]
                ],
                [
                    "development", 0.3, "Glorio's Invitation",
                    "The mysterious demon Glorio arrives at Capsule Corporation and asks Goku to defeat Gomah. Supreme Kai, who recognizes the danger of his home realm, joins them. Goku retrieves the Power Pole because his smaller body has disrupted familiar reach and balance. Leaving Vegeta, Piccolo, and Bulma to prepare another ship, the first trio follows Glorio through the passage into the Demon Realm.",
                    "Glorio offers useful access while concealing his true employer, so trust begins as a measured wager. Goku adapts his equipment immediately; Supreme Kai supplies cultural knowledge that strength cannot replace.",
                    "Trust need not be absolute to support a careful first step. What evidence is sufficient to cooperate while you continue checking someone's motives?",
                    ["goku", "glorio", "supreme-kai", "vegeta", "piccolo", "bulma"], ["glorio", "power-pole", "journey", "measured-trust"]
                ],
                [
                    "development", 0.48, "Gravity, Bandits, and a Stolen Plane",
                    "Goku, Supreme Kai, and Glorio enter the Third Demon World, where dense air makes flight difficult and the floating terrain punishes careless movement. They repel roadside bandits and stop at a rough settlement, only to have Glorio's plane stolen. The unfamiliar realm reduces speed, navigation, and supplies at once, forcing the travelers to solve ordinary logistics before confronting any ruler or guardian.",
                    "Goku treats difficult gravity as a new movement problem rather than an insult to his power. Glorio knows the customs but cannot prevent every setback, making local expertise valuable without making it infallible.",
                    "Competence is contextual. When the environment changes, which basic task deserves fresh attention before you attempt the impressive part of the mission?",
                    ["goku", "glorio", "supreme-kai"], ["third-demon-world", "gravity", "bandits", "logistics"]
                ],
                [
                    "preclimax", 0.7, "The Masked Majin",
                    "A masked fighter intervenes as Goku's group clashes with forces exploiting a local settlement. She is Panzy, a gifted young engineer wearing a control collar imposed under Gomah's rule. After the travelers help drive off the enforcers, Panzy reveals both her identity and her knowledge of the Third Demon World. Her repairs and navigation turn an accidental meeting into a durable alliance.",
                    "Panzy has lived under the system the visitors intend to challenge, so her stake is immediate rather than adventurous. Goku respects her practical skill, and Supreme Kai can remove a restraint that local resistance could not.",
                    "Outside help works best when it strengthens people already resisting. Are you solving the visible problem while listening to those who must live with the result?",
                    ["goku", "panzy", "glorio", "supreme-kai"], ["panzy", "control-collar", "local-resistance", "alliance"]
                ],
                [
                    "resolution", null, "King Kadan's Mission",
                    "Panzy brings the travelers to her father, King Kadan, who confirms that he sent Glorio to find Goku. Kadan wants Gomah removed and explains that the three Demon Realm Dragon Balls are guarded by powerful Tamagami. Gathering them could reverse the shrinking wish. With Panzy joining as mechanic and guide, the group gains a shared route, resources, and a goal beyond merely reaching the realm.",
                    "Kadan's political ambition overlaps with the heroes' rescue mission but is not identical to it. Panzy makes the alliance more accountable because she understands both her father's aims and her people's needs.",
                    "A coalition can work without pretending every motive is the same. Which shared objective is clear enough to coordinate while interests remain distinct?",
                    ["goku", "king-kadan", "panzy", "glorio", "supreme-kai"], ["king-kadan", "demon-dragon-balls", "tamagami", "resolution"]
                ],
                [
                    "mastery", null, "Toward the Three-Star Guardian",
                    "Panzy repairs their transport, Supreme Kai frees her from Gomah's collar, and the expanded group continues across the Third Demon World. Goku also spars with Glorio, learning the demon's magic while demonstrating that his smaller form can still become Super Saiyan. By the time Tamagami Number Three comes into view, strangers have become a functional expedition rather than passengers sharing a vehicle.",
                    "Goku's mastery appears as adjustment, not denial: he tests his changed balance, recovers old tools, and learns what new allies can do. Panzy gains freedom and chooses to keep traveling.",
                    "Mastery after disruption is the ability to rebuild a working system from altered parts. Which adaptation has now become a dependable strength?",
                    ["goku", "glorio", "panzy", "supreme-kai", "tamagami-three"], ["super-saiyan", "freedom", "expedition", "mastery"]
                ]
            ])
        },

        daima_supreme_kai: {
            id: "daima_supreme_kai",
            title: "The Tamagami and the Glind Legacy",
            series: "DAIMA",
            continuity: "daima_core",
            sourceNote: "Dragon Ball DAIMA episodes 8-14, covering the three Tamagami contests, Arinsu's Majin experiments, and the passage into the First Demon World.",
            sourceScope: { animeEpisodes: "8-14", boundary: "Ends as the combined travelers enter the First Demon World." },
            entries: makeEntries("daima_supreme_kai", "daima_core", [
                [
                    "entry", 0, "The Three-Star Tamagami",
                    "Goku challenges Tamagami Number Three for the Third Demon World Dragon Ball. The guardian's hammer and heavy attacks force Goku through Super Saiyan and Super Saiyan 2, while the Power Pole helps him manage distance. Winning the fight is only the first test: Goku also catches the Tamagami cheating during a rapid cup game, proving alert judgment as well as strength before receiving the ball.",
                    "Goku enjoys the guardian's fair combat and remains observant when the contest becomes playful deception. Tamagami Number Three accepts defeat honorably once both physical and mental tests are complete.",
                    "Power can earn an opportunity without finishing the task. After exertion, can you stay attentive enough for the quieter test that follows?",
                    ["goku", "tamagami-three", "panzy", "glorio", "supreme-kai"], ["tamagami", "super-saiyan-2", "three-star-ball", "attention"]
                ],
                [
                    "development", 0.14, "Arinsu Creates Majin Kuu",
                    "Away from the travelers, Dr. Arinsu works with the witch Marba, using a fragment of Majin Buu and a Saibaman seed to create Majin Kuu. Arinsu sends him against Tamagami Number One for the First Demon World Dragon Ball. Kuu is clever and eager to please, but he recognizes the guardian's superior strength and withdraws instead of being destroyed for someone else's ambition.",
                    "Arinsu treats life as an instrument for gaining a throne. Kuu begins as her creation yet immediately shows self-preservation, humor, and judgment that make him less controllable than a manufactured weapon should be.",
                    "Being created or recruited for a purpose does not remove your agency. When should loyalty yield to an honest assessment of needless harm?",
                    ["dr-arinsu", "marba", "majin-kuu", "tamagami-one"], ["majin-kuu", "creation", "tamagami", "agency"]
                ],
                [
                    "development", 0.3, "The Expedition Reunites",
                    "Vegeta, Piccolo, and Bulma finally reach the Demon Realm with Hybis and join the route toward the remaining Dragon Balls. Their arrival restores technical support and fighting depth, but it also creates competing preferences over who should face each Tamagami. Goku accepts that Vegeta wants the next contest, while Bulma and Panzy combine their engineering knowledge to keep the larger journey moving.",
                    "Vegeta does not want to be rescued from a worthy test by Goku, and Goku understands that pride can be directed productively. Bulma and Panzy quietly prevent the warriors' rivalry from becoming logistical paralysis.",
                    "Strong teammates do not need identical roles. What clear ownership lets competitive energy improve the mission instead of dividing it?",
                    ["goku", "vegeta", "piccolo", "bulma", "panzy", "hybis"], ["reunion", "team-roles", "engineering", "rivalry"]
                ],
                [
                    "development", 0.48, "Vegeta Beneath the Second Demon World",
                    "In the Second Demon World, Vegeta challenges Tamagami Number Two. A giant kraken drags him underwater, and the guardian presses the temporary advantage before Vegeta breaks free. The battle escalates across sea and sky as Vegeta refuses assistance. His smaller body and the hostile ocean complicate familiar movement, but they do not change his determination to claim the two-star ball himself.",
                    "Vegeta treats environmental interference as part of his test rather than grounds for complaint. Goku watches without intruding, respecting the line between support and stealing another fighter's chosen challenge.",
                    "Support sometimes means remaining ready without taking over. Can you tell when intervention protects the mission and when it diminishes someone else's growth?",
                    ["vegeta", "tamagami-two", "goku", "piccolo", "bulma"], ["second-demon-world", "kraken", "tamagami", "self-reliance"]
                ],
                [
                    "preclimax", 0.7, "Two Guardians Fall",
                    "Vegeta unveils Super Saiyan 3, overwhelms Tamagami Number Two, and solves the guardian's final logic challenge to earn the two-star ball. In the First Demon World, Arinsu's second creation, Majin Duu, succeeds where Kuu withdrew. Duu defeats Tamagami Number One, then relies on Kuu to answer the guardian's arithmetic question, winning the one-star ball through their complementary abilities.",
                    "Vegeta reveals preparation he kept private, converting pride into disciplined surprise. Kuu and Duu succeed as a pair because Duu's power and Kuu's quick mind are treated as equally necessary.",
                    "A breakthrough may be individual or shared, but it still depends on preparation. Which hidden practice or complementary partner could change your next difficult test?",
                    ["vegeta", "tamagami-two", "dr-arinsu", "majin-kuu", "majin-duu", "tamagami-one"], ["super-saiyan-3", "majin-duu", "dragon-balls", "complementary-skills"]
                ],
                [
                    "resolution", null, "Three Balls, Two Factions",
                    "The Tamagami contests end with all three Demon Realm Dragon Balls claimed, but not by one side. Goku's group holds the three-star ball, Vegeta's group holds the two-star ball, and Arinsu's Majin brothers carry the one-star ball. The physical quest is complete while control of its reward remains divided, turning the approaching reunion into a question of trust, leverage, and competing wishes.",
                    "The heroes earned their balls openly; Arinsu engineered champions to secure hers indirectly. Kuu and Duu nevertheless behave like brothers rather than extensions of her will, making the coming alignment less predictable.",
                    "Collecting resources is different from aligning their owners. What agreement is required before separate successes can become one usable outcome?",
                    ["goku", "vegeta", "dr-arinsu", "majin-kuu", "majin-duu"], ["three-dragon-balls", "split-control", "leverage", "resolution"]
                ],
                [
                    "mastery", null, "The Glind Story and the Sealed Passage",
                    "As the travelers move toward the First Demon World, Supreme Kai explains more of the Glind people's origins and the Demon Realm's connection to the wider universes. Gomah shuts down the Warp routes to stop them, but Neva uses ancient Namekian magic to remove the barrier around the passage. History and magic open the road that force alone could not.",
                    "Supreme Kai's value is clearest when cosmology becomes operational knowledge, not distant lore. Neva reveals that his earlier cooperation with Gomah did not define the full reach of his choices.",
                    "Mastery includes understanding the system around a challenge. Which piece of history or domain knowledge could reveal a route that effort keeps missing?",
                    ["supreme-kai", "neva", "goku", "vegeta", "gomah"], ["glind", "warp", "namekian-magic", "mastery"]
                ]
            ])
        },

        daima_true_form: {
            id: "daima_true_form",
            title: "The Evil Third Eye",
            series: "DAIMA",
            continuity: "daima_core",
            sourceNote: "Dragon Ball DAIMA episodes 15-20, covering the First Demon World confrontation, Third Eye Gomah, Super Saiyan 4, and the restoration wish.",
            sourceScope: { animeEpisodes: "15-20", boundary: "Begins after the First Demon World passage opens and runs through the series finale." },
            entries: makeEntries("daima_true_form", "daima_core", [
                [
                    "entry", 0, "Inside Gomah's Stronghold",
                    "The combined travelers enter the First Demon World and advance toward Gomah's palace while his Gendarmerie Force mobilizes. Degesu moves Dende as a hostage, hoping the infant guardian will secure his own escape if Gomah falls. At the same time, Gomah recognizes that Hybis has unknowingly worn the legendary Evil Third Eye as a belt ornament and orders it recovered.",
                    "Gomah has overlooked the artifact he wanted because it appeared ordinary, while Degesu prepares an exit before admitting the regime may fail. The heroes must rescue Dende without losing sight of the larger threat.",
                    "Critical risks often hide beside obvious objectives. What overlooked object, dependency, or escape route could change the balance of your current plan?",
                    ["goku", "gomah", "degesu", "dende", "hybis"], ["first-demon-world", "gendarmerie", "hostage", "evil-third-eye"]
                ],
                [
                    "development", 0.12, "Degesu's Failed Escape",
                    "Degesu takes Dende at gunpoint and attempts to flee the palace, but Panzy and the others corner him and recover the child. His independent bid for power collapses before it begins. Elsewhere, the demon sent to trade Hybis for his unusual belt delivers the Evil Third Eye to Gomah, who places it on his forehead and transforms into a giant ruler with overwhelming magic.",
                    "Panzy helps rescue someone whose abduction first drew the heroes into the realm, closing a personal loop through courage rather than royal status. Degesu's opportunism leaves him isolated from every side.",
                    "An exit plan built on harming others is brittle once cooperation forms against it. Which relationship makes coercion harder to sustain?",
                    ["degesu", "dende", "panzy", "gomah", "hybis"], ["dende-rescue", "betrayal", "third-eye-gomah", "cooperation"]
                ],
                [
                    "development", 0.24, "A Contest Interrupted",
                    "At Tamagami Number One's grounds, Goku's party meets Arinsu, Kuu, and Duu with all three Dragon Balls now present. Supreme Kai confronts his sister about her plan to take the Demon Realm throne. They agree to settle possession through a match between Goku and Duu, but the spirited contest ends abruptly when Third Eye Gomah arrives and attacks everyone without distinction.",
                    "Goku and Duu can compete joyfully even while their sponsors disagree. Arinsu expects creations and allies to serve her ambition, whereas Supreme Kai keeps treating them as people capable of choosing differently.",
                    "A fair contest can reveal common ground, but outside power may reject its rules. What alliance becomes possible when a larger threat interrupts rivalry?",
                    ["goku", "majin-duu", "majin-kuu", "dr-arinsu", "supreme-kai", "gomah"], ["tamagami-one", "sibling-conflict", "contest", "common-threat"]
                ],
                [
                    "development", 0.36, "Everyone Against Gomah",
                    "Goku calls for a coordinated assault as Third Eye Gomah's magic dwarfs every individual fighter. Vegeta, Piccolo, Supreme Kai, Glorio, Kuu, Duu, and Tamagami Number One join him, but the empowered ruler heals and replenishes himself faster than they can wear him down. Goku turns Super Saiyan 3, yet even that concentrated power cannot overcome the Eye's continuous advantage.",
                    "The group abandons factional lines without pretending they have disappeared. Goku asking everyone to attack together marks a shift from testing himself to organizing survival against a self-renewing opponent.",
                    "Teamwork cannot solve every capacity gap, but it reveals the true shape of one. What does coordinated effort teach you about the bottleneck?",
                    ["goku", "vegeta", "piccolo", "supreme-kai", "glorio", "majin-kuu", "majin-duu", "tamagami-one", "gomah"], ["third-eye-gomah", "team-battle", "super-saiyan-3", "capacity-gap"]
                ],
                [
                    "development", 0.48, "Neva Awakens a Deeper Power",
                    "Neva draws out power within Goku, whose body changes into a new Super Saiyan 4 form with restored adult scale, a tail, and immense strength. Goku can finally injure Gomah and drive him back. The Evil Third Eye responds by enlarging its bearer again and restoring his stamina, turning Goku's breakthrough into parity rather than a clean finish.",
                    "Neva contributes through discernment: he recognizes potential the fighters cannot access alone. Goku accepts the unfamiliar form immediately, testing it through movement instead of pausing to demand certainty about its origin.",
                    "A breakthrough may change the contest without ending it. Can you value new capacity while continuing to study the system that still resists you?",
                    ["goku", "neva", "gomah"], ["super-saiyan-4", "awakening", "third-eye", "breakthrough"]
                ],
                [
                    "development", 0.62, "Glorio Chooses His Wish",
                    "Arinsu orders Glorio to gather the three Dragon Balls and summon the enormous Demon Realm dragon. She expects him to wish her into supreme rule, but Glorio instead asks that everyone diminished by Gomah's Earth wish be restored. Goku, Vegeta, Piccolo, Supreme Kai, Dende, and their friends return to normal size, and the balls scatter before Arinsu can redirect the result.",
                    "Glorio repays trust by rejecting the person who once rescued and employed him. His choice does not erase earlier deception; it proves that loyalty can mature into judgment rather than permanent obedience.",
                    "Gratitude is not a lifetime surrender of conscience. Which debt can you honor without letting it decide every future choice?",
                    ["glorio", "dr-arinsu", "demon-realm-porunga", "goku", "vegeta", "piccolo", "dende"], ["demon-dragon-balls", "restoration-wish", "choice", "loyalty"]
                ],
                [
                    "preclimax", 0.78, "Three Strikes",
                    "Restored Vegeta challenges Gomah until exhaustion gives Goku another turn in Super Saiyan 4. Arinsu and Kuu discover the Eye can be dislodged by three blows to the back of its wearer's head. Piccolo nearly completes the sequence, but Gomah interrupts it and heals. The battle becomes a precise team problem: create one opening and deliver the required pattern before recovery resets it.",
                    "Vegeta yields only when Bulma makes the practical limit undeniable. Piccolo converts Arinsu's research into action, while Goku uses pressure to hold Gomah's attention rather than chasing a solitary finish.",
                    "Once the mechanism is known, discipline matters more than spectacle. Can the team protect the exact sequence that makes success possible?",
                    ["goku", "vegeta", "bulma", "piccolo", "dr-arinsu", "majin-kuu", "gomah"], ["super-saiyan-4", "weakness", "three-strikes", "preclimax"]
                ],
                [
                    "resolution", null, "The Eye Falls",
                    "While Gomah boasts, Majin Kuu uses Arinsu's magic-item book to strike the back of his head three times. The Evil Third Eye pops free, and Glorio crushes it before anyone can reclaim its power. Gomah shrinks to his former state. Marba seals Gomah and Degesu away for ninety-nine years, and Kuu unexpectedly becomes the Demon Realm's new king with Duu beside him.",
                    "Kuu wins through timing and comprehension, not the raw power his creator originally wanted. Glorio completes his break with the old scheme by destroying the artifact instead of trying to own it.",
                    "Resolution often depends on the person who understands the instruction and acts at the unguarded moment. Who is positioned to make the precise final move?",
                    ["majin-kuu", "glorio", "gomah", "degesu", "marba", "majin-duu"], ["evil-third-eye", "gomah-defeated", "new-king", "resolution"]
                ],
                [
                    "mastery", null, "Friends Across the Demon Worlds",
                    "Dende is safe, Gomah's wish is reversed, and the travelers say farewell to Panzy, Glorio, Kadan, Neva, and the Majin brothers before returning to Earth. The adventure leaves the Demon Realm connected to friends rather than reduced to a distant source of danger. Goku carries a newly awakened form home, but the deeper achievement is a network built across worlds once divided by fear and control.",
                    "Panzy and Glorio finish as partners who chose the expedition, not pieces moved by rulers. Goku's strength mattered most when it created room for their knowledge and decisions to matter too.",
                    "Mastery is what remains after the emergency: restored people, durable trust, and power held without needing to dominate the world that revealed it.",
                    ["goku", "panzy", "glorio", "king-kadan", "neva", "majin-kuu", "majin-duu", "dende"], ["farewell", "demon-realm", "friendship", "mastery"]
                ]
            ])
        },

        dbs_beerus: {
            id: "dbs_beerus",
            title: "God of Destruction Beerus",
            series: "DBS",
            continuity: "super_anime",
            sourceNote: "Dragon Ball Super anime episodes 1-14, the television version of the Beerus and Super Saiyan God conflict.",
            sourceScope: { animeEpisodes: "1-14", adaptation: "Dragon Ball Super television continuity" },
            entries: makeEntries("dbs_beerus", "super_anime", [
                [
                    "entry", 0, "Peace and a Prophetic Dream",
                    "Years after Majin Buu's defeat, Earth enjoys peace while Goku trains on King Kai's planet and Vegeta spends rare time with his family. Far away, Beerus wakes from a long sleep after dreaming of a Super Saiyan God. The God of Destruction learns that Frieza was defeated by a Saiyan and begins searching for the warrior his dream promised.",
                    "Goku still seeks difficulty during peace, while Vegeta experiments with obligations beyond training. Beerus enters their lives as a scale of power neither Saiyan knows exists, guided by curiosity as much as destruction.",
                    "Peace can reveal whether your discipline has a purpose beyond emergency. What are you maintaining now, before the next difficult demand announces itself?",
                    ["goku", "vegeta", "beerus", "whis", "king-kai"], ["beerus", "prophecy", "peace", "divine-power"]
                ],
                [
                    "development", 0.12, "The Search for a Saiyan God",
                    "Beerus and Whis follow the trail from Frieza's defeat to the surviving Saiyans. King Kai urgently warns Goku not to provoke the visitor, and Vegeta remembers Beerus humiliating King Vegeta long ago. No one knows what a Super Saiyan God is. The search therefore combines divine memory, incomplete prophecy, and Beerus's dangerous willingness to erase worlds when disappointed by their answers or their food.",
                    "Beerus's authority has taught gods and kings to manage his mood rather than challenge his judgment. Goku hears the warning clearly but remains unable to place caution above the chance to test himself.",
                    "Curiosity is useful until it ignores asymmetric risk. When does learning by direct trial expose everyone else to consequences they did not choose?",
                    ["beerus", "whis", "goku", "king-kai", "vegeta", "king-vegeta"], ["super-saiyan-god", "king-kai", "warning", "risk"]
                ],
                [
                    "development", 0.24, "Two Blows on King Kai's World",
                    "Goku asks Beerus for a spar despite King Kai's objections and climbs through his Super Saiyan forms. Even Super Saiyan 3 cannot create a meaningful contest. Beerus disables him with a pressure-point strike and a light flick, then continues toward Earth. Goku survives with a precise understanding: his familiar ladder of transformations does not approach the level now threatening his friends.",
                    "Goku receives the cleanest possible correction to his assumptions and does not disguise it as bad luck. Beerus demonstrates overwhelming control, using minimal motion to settle a challenge beneath his full attention.",
                    "A decisive loss can save months of false calibration. What measurement would tell you that the gap requires a new model rather than more intensity?",
                    ["goku", "beerus", "king-kai", "whis"], ["super-saiyan-3", "defeat", "calibration", "king-kai-planet"]
                ],
                [
                    "development", 0.36, "Vegeta's Birthday Diplomacy",
                    "Beerus arrives during Bulma's birthday party, where Vegeta recognizes him and suppresses every proud instinct to keep Earth safe. Food distracts the visitor, and Vegeta performs awkward hospitality while the others celebrate without understanding the danger. His strategy looks undignified, but it temporarily succeeds: restraint protects the planet longer than any attack available to him could have done.",
                    "Vegeta carries knowledge no one else shares and accepts embarrassment as the price of prevention. Bulma treats Beerus as a rude guest because she has not been conditioned by the fear that shaped Vegeta's childhood.",
                    "Restraint may look weak to people who cannot see the stakes. Which uncomfortable action protects the group better than displaying your strength?",
                    ["vegeta", "beerus", "bulma", "whis", "trunks"], ["birthday-party", "restraint", "hospitality", "vegeta"]
                ],
                [
                    "development", 0.48, "Pudding, Pride, and Bulma's Anger",
                    "Majin Buu refuses to share his pudding, and Beerus's irritation erupts into violence. Earth's fighters attack one after another but cannot slow him. When Beerus strikes Bulma after she confronts him, Vegeta's anger drives him beyond his usual limits for a brief assault. It still fails, yet his response reveals that protecting his family now reaches deeper than fear of a god.",
                    "Vegeta's greatest burst comes from attachment he once treated as weakness. Bulma refuses to make divinity an excuse for cruelty, while Beerus keeps confusing absolute power with freedom from proportion.",
                    "Values become visible when consequences are severe. What commitment can move you past an old fear without making you careless about the cost?",
                    ["beerus", "majin-buu", "vegeta", "bulma", "gohan", "piccolo"], ["pudding", "bulma", "family", "courage"]
                ],
                [
                    "development", 0.62, "Shenron Explains the Ritual",
                    "Goku returns and asks Shenron about the Super Saiyan God. The dragon explains that five righteous Saiyans must channel their hearts into a sixth. Goku, Vegeta, Gohan, Trunks, and Goten appear one participant short until Videl reveals she is pregnant with Gohan's child. Including the unborn Pan completes the ritual, and Goku emerges with red hair and divine power.",
                    "The transformation cannot be forced by Goku alone; it depends on family, trust, and a life not yet born. Goku accepts borrowed power even while admitting discomfort that he did not earn it individually.",
                    "Some thresholds are relational by design. Can you receive a shared gift honestly without pretending it was a solitary achievement?",
                    ["goku", "shenron", "vegeta", "gohan", "trunks", "goten", "videl", "pan"], ["ritual", "super-saiyan-god", "family", "shared-power"]
                ],
                [
                    "preclimax", 0.78, "A Battle That Shakes the Universe",
                    "Super Saiyan God Goku fights Beerus from Earth's atmosphere into space. Their clashes threaten the universe until Goku learns to match the angle and force of Beerus's blows, canceling the destructive waves. When the ritual's visible form expires, Goku keeps much of its power and continues. Adaptation, not the ritual alone, lets a mortal keep answering a god's escalating test.",
                    "Goku learns during impact, protecting the universe by refining control inside the fight. Beerus becomes genuinely engaged because the challenger keeps incorporating each lesson instead of merely enduring punishment.",
                    "Greater power increases the cost of poor control. What technique must improve alongside capacity so progress stops spilling harm into everything nearby?",
                    ["goku", "beerus", "whis"], ["super-saiyan-god", "universe", "ki-control", "preclimax"]
                ],
                [
                    "resolution", null, "Earth Is Spared",
                    "Beerus finally overpowers Goku and prepares an attack meant to erase Earth. Goku rises once more and neutralizes the sphere, but he can no longer sustain the contest and admits defeat. Beerus acknowledges his potential. Rather than destroy the planet, he claims exhaustion and leaves with Whis, allowing Earth to survive after tasting both its food and its fighters' resolve.",
                    "Goku's honest surrender does not diminish the courage of the attempt. Beerus chooses restraint without surrendering his intimidating role, suggesting that respect can reach even someone accustomed to obedience through fear.",
                    "Resolution sometimes comes from earning reconsideration, not overpowering the threat. What would make a stronger opponent choose a less destructive outcome?",
                    ["goku", "beerus", "whis", "vegeta", "bulma"], ["earth-spared", "defeat", "respect", "resolution"]
                ],
                [
                    "mastery", null, "A Divine Horizon",
                    "Beerus and Whis depart, leaving the celebration damaged but the world intact. Goku now knows that beings far beyond Super Saiyan 3 exist and that divine power requires calm control as well as intensity. Vegeta has also seen a path larger than their old rivalry. Earth returns to ordinary life with its defenders humbled, connected, and newly aware of the universe's scale.",
                    "Goku does not convert survival into a false claim of victory. Vegeta's protective rage and Goku's adaptive control reveal different strengths that can now develop under the same expanded horizon.",
                    "Mastery is a more accurate map of what remains to learn. Which recent challenge enlarged your horizon without erasing the progress that brought you there?",
                    ["goku", "vegeta", "beerus", "whis"], ["god-ki", "humility", "new-horizon", "mastery"]
                ]
            ])
        },

        dbs_golden_frieza: {
            id: "dbs_golden_frieza",
            title: "Golden Frieza",
            series: "DBS",
            continuity: "super_anime",
            sourceNote: "Dragon Ball Super anime episodes 15-27, the television Resurrection 'F' arc from Frieza's revival through Earth's restoration.",
            sourceScope: { animeEpisodes: "15-27", adaptation: "Dragon Ball Super television continuity" },
            entries: makeEntries("dbs_golden_frieza", "super_anime", [
                [
                    "entry", 0, "Frieza Returns",
                    "Sorbet leads the weakened Frieza Force to Earth and uses the Dragon Balls to resurrect Frieza, whose body is restored after regeneration technology repairs it. Learning that Goku defeated Majin Buu and fought Beerus, Frieza recognizes that returning with old strength would repeat old failure. For the first time in his life, the naturally gifted tyrant commits to sustained training before seeking revenge.",
                    "Frieza responds to defeat by becoming more disciplined without becoming less cruel. Sorbet restores a leader he hopes will restore the army, confusing centralized terror with institutional stability.",
                    "Discipline amplifies purpose; it does not improve it. What value is your training serving as your capacity becomes more effective?",
                    ["frieza", "sorbet", "shenron", "pilaf", "shu", "mai"], ["frieza-revived", "dragon-balls", "training", "revenge"]
                ],
                [
                    "development", 0.14, "Training Under Whis",
                    "Goku and Vegeta train on Beerus's world under Whis, who criticizes Goku's relaxed guard and Vegeta's inability to stop thinking before every move. They learn to contain godly ki and reach Super Saiyan Blue. Elsewhere, Frieza trains for four months and unlocks a golden form. Both sides make extraordinary gains, but neither has fully corrected the habits hidden beneath new power.",
                    "Whis diagnoses opposite weaknesses rather than giving both Saiyans one generic lesson. Frieza treats transformation as proof of readiness and leaves no time to test its efficiency under prolonged resistance.",
                    "A breakthrough can conceal the old flaw inside a stronger system. What stress test would expose whether your new ability is actually stable?",
                    ["goku", "vegeta", "whis", "beerus", "frieza"], ["super-saiyan-blue", "golden-frieza", "training", "hidden-flaws"]
                ],
                [
                    "development", 0.3, "The Frieza Force Lands",
                    "Jaco warns Bulma that Frieza is approaching Earth with a large army while Goku and Vegeta remain beyond easy contact. Gohan, Piccolo, Krillin, Tien, Master Roshi, and Jaco meet the invasion without them. The defenders defeat waves of soldiers through coordination and experience, buying time while Frieza watches for the opponents he actually came to punish.",
                    "Earth's defense does not wait for its two strongest fighters. Gohan is out of practice but still stands forward; Roshi and Krillin show that judgment and teamwork remain useful across enormous power differences.",
                    "A resilient team can act before its ideal resources arrive. What useful contribution is available now, even if the strongest specialist is absent?",
                    ["gohan", "piccolo", "krillin", "tien-shinhan", "master-roshi", "jaco", "frieza"], ["frieza-force", "earth-defense", "teamwork", "readiness"]
                ],
                [
                    "development", 0.48, "Ginyu's Return and Piccolo's Sacrifice",
                    "Captain Ginyu, trapped for years as a frog, uses Tagoma to trigger a body swap and returns to battle, only for Vegeta to end the threat. Frieza then tortures an exhausted Gohan to draw Goku's attention. Piccolo intercepts a killing blast and dies protecting his former student. The invasion becomes personal before Goku and Vegeta finally receive Whis's message and return.",
                    "Ginyu repeats the identity theft that once defined him, showing no growth beyond opportunity. Piccolo again places Gohan's life before his own, while Gohan confronts the cost of allowing his training to lapse.",
                    "Past skill is not permanent readiness. Which responsibility requires maintenance because someone else may pay the price when your preparation fades?",
                    ["captain-ginyu", "tagoma", "vegeta", "frieza", "gohan", "piccolo"], ["ginyu", "piccolo-sacrifice", "gohan", "consequences"]
                ],
                [
                    "preclimax", 0.7, "Blue Against Gold",
                    "Goku and Vegeta arrive, and Goku confronts Frieza after quickly ending Ginyu's return. Goku reveals Super Saiyan Blue; Frieza answers with Golden Frieza and initially dominates. Goku recognizes that Frieza rushed to Earth before mastering the form, whose energy drains rapidly. As the advantage shifts, Goku lowers his guard, allowing Sorbet's concealed ray to wound him critically.",
                    "Goku reads Frieza's stamina failure correctly but repeats the vulnerability Whis identified in training. Frieza cannot accept that efficient patience may matter more than the dazzling peak he built for revenge.",
                    "Correct analysis does not excuse careless execution. Where are you most likely to relax precisely because you believe you have already solved the problem?",
                    ["goku", "vegeta", "frieza", "sorbet"], ["blue-versus-gold", "stamina", "lowered-guard", "preclimax"]
                ],
                [
                    "resolution", null, "Three Minutes Reclaimed",
                    "Vegeta takes Goku's place, reveals his own Super Saiyan Blue power, and overwhelms the exhausted Frieza. Rather than accept defeat, Frieza destroys Earth, killing Vegeta and almost everyone on it. Whis rewinds time by three minutes, giving Goku one chance to act before the attack. Goku immediately destroys Frieza, preserving the world at the cost of Vegeta's earned finishing blow.",
                    "Vegeta's victory is erased by Frieza's refusal to lose, and Goku must correct his earlier delay without hesitation. Whis offers time, not a second guarantee; disciplined action makes the difference.",
                    "A second chance has value only if behavior changes inside it. What exact action would you take sooner if three lost minutes were returned?",
                    ["vegeta", "frieza", "goku", "whis", "beerus"], ["earth-destroyed", "time-rewind", "frieza-defeated", "resolution"]
                ],
                [
                    "mastery", null, "Power Without the Same Mistake",
                    "Frieza returns to his punishment in the afterlife, while Earth's Dragon Balls cannot revive Piccolo because they died with him. The heroes instead use Namek's Dragon Balls to restore him. Goku and Vegeta acknowledge that cooperation might have prevented the crisis, even if neither likes the idea. Their new divine forms survive the battle; the larger lesson is that power without vigilance or coordination remains dangerously incomplete.",
                    "Goku owns the cost of dropping his guard, and Vegeta sees how isolation denied him the finish he earned. Piccolo's return restores the mentor whose sacrifice exposed both failures.",
                    "Mastery is retaining the lesson after the emergency is repaired. Which avoidable mistake deserves a system change rather than a promise to try harder?",
                    ["goku", "vegeta", "piccolo", "frieza", "whis"], ["piccolo-revived", "cooperation", "vigilance", "mastery"]
                ]
            ])
        },

        dbs_universe6: {
            id: "dbs_universe6",
            title: "The Universe 6 Tournament",
            series: "DBS",
            continuity: "super_anime",
            sourceNote: "Dragon Ball Super anime episodes 28-41, from Champa's tournament proposal through Beerus's Super Dragon Ball wish.",
            sourceScope: { animeEpisodes: "28-41", adaptation: "Dragon Ball Super television continuity" },
            entries: makeEntries("dbs_universe6", "super_anime", [
                [
                    "entry", 0, "Champa's Wager",
                    "Beerus's twin brother Champa arrives with Vados and compares the foods of Universe 6 and Universe 7. After discovering that Universe 6's Earth was devastated, he proposes a five-on-five tournament: if his team wins, he will exchange the universes' Earths; if Beerus wins, he receives Champa's six planet-sized Super Dragon Balls. Their rivalry turns cosmic power into a structured contest.",
                    "Beerus and Champa share status and appetite but express rivalry through constant comparison. Vados and Whis manage the practical consequences, translating impulsive wagers into rules, travel, and an arena.",
                    "Competition becomes safer when stakes and rules are explicit. What agreement keeps rivalry from spilling into damage neither side intended?",
                    ["beerus", "champa", "whis", "vados"], ["universe-6", "super-dragon-balls", "tournament", "rivalry"]
                ],
                [
                    "development", 0.14, "Five Fighters and a Written Test",
                    "Universe 7 selects Goku, Vegeta, Piccolo, Majin Buu, and Beerus's mysterious favorite Monaka. The tournament is built on the Nameless Planet, and a basic written exam ensures competitors can understand the rules. Buu falls asleep and fails, reducing the team before combat begins. Monaka's supposed strength remains a motivational fiction Beerus uses to push Goku and Vegeta.",
                    "The written test defeats a powerhouse whom battle might not, proving that participation has more than one requirement. Beerus manipulates his Saiyans through Monaka rather than trusting their motivation directly.",
                    "Eligibility can depend on fundamentals outside your strongest domain. Which basic requirement could quietly undo excellent specialized preparation?",
                    ["goku", "vegeta", "piccolo", "majin-buu", "monaka", "beerus"], ["team-universe-7", "written-test", "monaka", "fundamentals"]
                ],
                [
                    "development", 0.3, "Botamo and Frost",
                    "Goku opens against Botamo, whose body absorbs damage, and wins by carrying him out of the ring instead of trying to overpower the effect. Frost then presents himself as a heroic counterpart to Frieza and appears to defeat Goku after a close match. Piccolo takes the next fight, using careful distance and a Special Beam Cannon plan against the apparently stronger opponent.",
                    "Goku solves Botamo by remembering the victory condition rather than chasing damage. Frost's polished reputation lowers everyone's suspicion, while Piccolo accepts a narrow tactical path and patiently builds toward it.",
                    "The objective is not always the same as dominating the obstacle. What simpler win condition becomes visible when you stop measuring only force?",
                    ["goku", "botamo", "frost", "piccolo"], ["botamo", "frost", "ring-out", "tactics"]
                ],
                [
                    "development", 0.48, "Frost Exposed, Magetta Endures",
                    "Frost defeats Piccolo by using a hidden poison needle, but Jaco notices the violation and exposes his false heroism. Vegeta insists Frost remain so he can defeat him personally, then eliminates him immediately. Against the metalman Magetta, Vegeta struggles with heat, sound, and the arena barrier until an insult breaks Magetta's confidence and ends a physically punishing contest.",
                    "Jaco's observation restores fairness when stronger witnesses miss the evidence. Vegeta's anger serves justice against Frost, but his victory over Magetta also reveals how readily he will exploit an opponent's emotional vulnerability.",
                    "Integrity needs witnesses who notice details, while competition still rewards psychological insight. How will you use an opponent's weakness without abandoning your own standards?",
                    ["frost", "piccolo", "jaco", "vegeta", "magetta"], ["poison", "disqualification", "magetta", "integrity"]
                ],
                [
                    "preclimax", 0.7, "Cabba's Lesson and Hit's Time-Skip",
                    "Vegeta faces the young Universe 6 Saiyan Cabba, who does not know how to become a Super Saiyan. Vegeta provokes his anger with threats, then reveals the cruelty was instruction and asks him to surpass the Saiyan king. Vegeta next meets Hit, whose Time-Skip makes conventional reactions useless. The assassin defeats him before Vegeta can decode the interval between intention and impact.",
                    "Vegeta becomes a severe mentor because he recognizes a Saiyan legacy larger than his own universe. Against Hit, pride meets a technique that punishes predictable timing rather than insufficient strength.",
                    "Teaching sometimes requires pressure, but pressure needs a constructive destination. How will the learner know the challenge was meant to expand rather than diminish them?",
                    ["vegeta", "cabba", "hit"], ["cabba", "super-saiyan", "hit", "time-skip"]
                ],
                [
                    "resolution", null, "Goku Versus Hit",
                    "Goku studies Hit's rhythm, predicts where the assassin will emerge, and combines Super Saiyan Blue with Kaio-ken to pressure the improving Time-Skip. Unwilling to continue under rules that prevent Hit from using lethal techniques, Goku withdraws. Hit then understands Monaka's true level and deliberately loses, giving Universe 7 the tournament while denying Champa the satisfaction of a manipulated finish.",
                    "Goku values a complete future contest more than the official bracket, and Hit responds with his own refusal to be used. Both fighters sacrifice a nominal result to preserve autonomy and mutual respect.",
                    "Resolution need not mean clinging to the scoreboard. What result would you release to protect the quality of the challenge or the freedom of its participants?",
                    ["goku", "hit", "monaka", "beerus", "champa"], ["kaio-ken-blue", "time-skip", "withdrawal", "resolution"]
                ],
                [
                    "mastery", null, "The Wish Beerus Does Not Announce",
                    "After Universe 7 wins, Bulma locates the final Super Dragon Ball and the colossal Super Shenron appears. Beerus quietly wishes for Universe 6's Earth and its people to be restored, giving Champa access to the food he coveted without taking Universe 7's world. Zeno then arrives and enjoys the tournament enough to propose a future contest involving all universes.",
                    "Beerus hides generosity behind rivalry, helping his brother without demanding gratitude. Goku's enthusiasm pleases Zeno, but the new friendship also places mortal competition within a far more powerful authority structure.",
                    "Mastery can turn victory into restoration rather than possession. What generous use of the prize would improve both sides after the contest ends?",
                    ["beerus", "champa", "super-shenron", "zeno", "goku"], ["super-shenron", "universe-6-earth", "zeno", "mastery"]
                ]
            ])
        },

        dbs_copy_vegeta: {
            id: "dbs_copy_vegeta",
            title: "Copy-Vegeta",
            series: "DBS",
            continuity: "anime_only",
            sourceNote: "Dragon Ball Super anime episodes 44-46, an anime-original Potaufeu interlude; standalone episodes 42-43 are outside this pack.",
            sourceScope: { animeEpisodes: "44-46", adaptation: "Anime-original side story" },
            entries: makeEntries("dbs_copy_vegeta", "anime_only", [
                [
                    "entry", 0, "A Delivery to Potaufeu",
                    "Goten and Trunks hide aboard Monaka's delivery ship and arrive on Planet Potaufeu, where space criminal Gryll is hunting a sealed substance guarded by Potage. Vegeta and Jaco follow to retrieve the boys. The substance, known as Commeson or Superhuman Water, escapes confinement and reveals why Potage feared it: the liquid can copy a person's power and personality by absorbing them.",
                    "Goten and Trunks turn boredom into danger by treating another person's work as transport for adventure. Potage appears timid but has spent years protecting others from a weapon whose threat is imitation itself.",
                    "Curiosity without consent transfers risk to rescuers. What boundary should you respect before turning someone else's responsibility into your experiment?",
                    ["goten", "trunks", "monaka", "potage", "gryll", "vegeta", "jaco"], ["potaufeu", "commeson", "stowaways", "risk"]
                ],
                [
                    "development", 0.3, "The Living Copy",
                    "Commeson absorbs Gryll and his men, producing duplicates with their abilities before turning on Vegeta. When Vegeta is absorbed, the liquid creates Copy-Vegeta with his memories, techniques, and current strength. The real Vegeta becomes translucent and learns he will disappear if the copy remains alive. Destroying the duplicate is now both a battle and a race to preserve the original identity.",
                    "Copy-Vegeta possesses Vegeta's combat pride without the relationships that shaped its recent growth. The original confronts a disturbing measure of himself: equal power detached from ownership, history, and responsibility.",
                    "Competence can be copied more easily than character. Which habits prove that your identity is more than the output someone else could imitate?",
                    ["commeson", "gryll", "vegeta", "copy-vegeta", "potage"], ["copy-vegeta", "identity", "absorption", "time-limit"]
                ],
                [
                    "preclimax", 0.62, "Goku Versus Vegeta's Double",
                    "Copy-Vegeta defeats Gotenks and prepares to finish the children before Goku arrives. Goku fights the duplicate in Super Saiyan Blue and finds an opponent carrying Vegeta's full power. The fading Vegeta is torn between wanting Goku to win and objecting whenever his copy appears inferior. Potage searches for the Commeson core while the fighters hold the replica's attention.",
                    "Goku treats the duplicate as a real tactical threat without confusing it for his friend. Vegeta's contradictory cheering supplies comic honesty: survival and competitive pride are both genuine parts of him.",
                    "Conflicting feelings do not prevent useful action if the priority stays clear. What emotion can you acknowledge without letting it decide the mission?",
                    ["goku", "vegeta", "copy-vegeta", "gotenks", "potage"], ["super-saiyan-blue", "goku-versus-copy", "pride", "preclimax"]
                ],
                [
                    "resolution", null, "Monaka Steps on the Core",
                    "Potage identifies the gem-like Commeson core as the duplicate's vulnerable point, but reaching it during Goku's battle proves difficult. Monaka wanders into the struggle and accidentally crushes the core underfoot. Copy-Vegeta destabilizes and dissolves before the original vanishes, returning Vegeta to solid form. An unplanned step succeeds because the others survived long enough to expose the right target.",
                    "Monaka resolves a god-level-looking crisis without strength or intention, undercutting every assumption built around his reputation. Potage's knowledge matters as much as Goku's ability to keep the copy occupied.",
                    "Resolution can come through a small action once the team identifies the true mechanism. Are you protecting the conditions that let an unlikely solution work?",
                    ["monaka", "potage", "copy-vegeta", "vegeta", "goku"], ["commeson-core", "monaka", "vegeta-restored", "resolution"]
                ],
                [
                    "mastery", null, "Originals, Copies, and Consequences",
                    "With Commeson destroyed, Potage can again protect Potaufeu and the visitors leave the planet. Goten and Trunks survive the adventure they entered without permission, while Vegeta retains a unique experience of watching his own power operate from outside himself. The interlude leaves no stronger transformation behind; its lesson is that borrowed ability lacks the bonds and accountability that give strength direction.",
                    "Vegeta is relieved without surrendering his rivalry with Goku, and the boys see how quickly playful secrecy can become someone else's emergency. Potage's quiet stewardship proves decisive from beginning to end.",
                    "Mastery is not merely producing the same result as an expert. It is carrying responsibility for when, why, and for whom that ability is used.",
                    ["vegeta", "goku", "goten", "trunks", "potage", "monaka"], ["originality", "accountability", "potaufeu", "mastery"]
                ]
            ])
        },

        dbs_future_trunks: {
            id: "dbs_future_trunks",
            title: "Future Trunks and the Zero Mortal Plan",
            series: "DBS",
            continuity: "super_anime",
            sourceNote: "Dragon Ball Super anime episodes 47-67, the television Future Trunks arc from Goku Black's pursuit through the loss of Trunks's timeline.",
            sourceScope: { animeEpisodes: "47-67", adaptation: "Dragon Ball Super television continuity" },
            entries: makeEntries("dbs_future_trunks", "super_anime", [
                [
                    "entry", 0, "A Future Under Goku Black",
                    "Future Trunks's rebuilt world is attacked by a warrior wearing Goku's face and calling himself Goku Black. Resistance leader Mai appears to fall while helping Trunks reach Bulma's repaired time machine. Trunks escapes to the past with barely enough fuel, carrying a warning to friends who remember him as the young victor over the androids. His future has survived before, but recovery never made it untouchable.",
                    "Trunks returns not as a triumphant savior but as a survivor forced to ask for help again. Mai turns resistance into organized hope, buying movement for the one person who can reach allies outside their timeline.",
                    "Needing help again does not invalidate an earlier victory. What changed conditions make renewed support the responsible choice rather than a retreat?",
                    ["future-trunks", "future-mai", "goku-black", "future-bulma"], ["future-timeline", "goku-black", "resistance", "return"]
                ],
                [
                    "development", 0.12, "Black Crosses Time",
                    "Bulma, Goku, and Vegeta revive Trunks and hear his account. Goku spars with him to understand Black's strength. The Time Ring then pulls Goku Black into the present, where he battles Goku and sees the Saiyans and their world before the distortion returns him to the future. The encounter confirms a divine time tool is involved and gives Black new combat experience.",
                    "Goku uses a controlled fight to turn Trunks's fear into usable information. Black treats every clash as material for growth, making even a brief reconnaissance dangerous if the heroes reveal too much.",
                    "Information gathering changes both sides. What can you learn from a test without teaching the opposition more than you can afford?",
                    ["future-trunks", "goku", "vegeta", "bulma", "goku-black"], ["time-ring", "sparring", "reconnaissance", "information"]
                ],
                [
                    "development", 0.24, "Zamasu's Justice",
                    "Beerus and Whis trace the Time Ring to Universe 10, where apprentice Supreme Kai Zamasu serves Gowasu while expressing contempt for mortal violence. Goku's visit and spar deepen Zamasu's resentment of mortal power. Through GodTube and questions about the Super Dragon Balls, his abstract prejudice acquires a method. The investigators see warning signs, but not yet the complete route connecting him to Black.",
                    "Gowasu answers doubt with observation and patience, but Zamasu filters every example through a conclusion already chosen. Goku's open challenge is innocent, yet it becomes evidence inside someone else's closed ideology.",
                    "More information cannot correct a belief designed to reinterpret everything. What evidence would genuinely change your view, and have you allowed any to qualify?",
                    ["zamasu", "gowasu", "goku", "beerus", "whis"], ["universe-10", "zamasu", "gowasu", "ideology"]
                ],
                [
                    "development", 0.36, "Rosé and the Immortal God",
                    "Goku, Vegeta, and Trunks travel to the ruined future and reunite with Mai's resistance. Goku Black reveals Super Saiyan Rosé, while the future timeline's Zamasu appears beside him and heals every injury. The heroes learn that Zamasu is immortal and Black grows stronger through combat. Overwhelmed by the pair's coordination, they retreat to the past rather than spend their last options in a losing battle.",
                    "Black and Zamasu combine adaptation with restoration, turning ordinary exchanges into permanent advantage. Trunks hates leaving his people again, but retreat preserves the only group able to bring back a different plan.",
                    "Strategic withdrawal can protect responsibility rather than abandon it. Which resource must survive today for the mission to have another attempt?",
                    ["goku", "vegeta", "future-trunks", "future-mai", "goku-black", "future-zamasu"], ["super-saiyan-rose", "immortality", "retreat", "future-resistance"]
                ],
                [
                    "development", 0.48, "Beerus Changes One Present",
                    "Whis discovers that Zamasu plans to murder Gowasu. Beerus, Goku, and Whis intervene at the moment of betrayal, expose the apprentice, and Beerus destroys him. They hope the act will erase Goku Black, but Trunks's future remains unchanged because time travel has created separate histories. Stopping the present Zamasu prevents one disaster without retroactively repairing a branch where his plan already succeeded.",
                    "Beerus acts decisively once evidence replaces suspicion, while Trunks learns that divine intervention still obeys consequences. The relief of prevention must coexist with responsibility for the timeline it cannot rescue automatically.",
                    "One successful intervention may solve only one branch of a problem. Where are you mistaking prevention here for repair everywhere?",
                    ["beerus", "zamasu", "gowasu", "whis", "goku", "future-trunks"], ["hakai", "timeline-branch", "prevention", "consequences"]
                ],
                [
                    "development", 0.62, "The Zero Mortal Plan Revealed",
                    "The heroes return to the future and learn the villains' full design. Zamasu used the Super Dragon Balls to exchange bodies with Goku, becoming Black, then killed Goku and his family. He joined the future Zamasu, who had wished for immortality, and together they began erasing mortals and gods. Vegeta's focused training lets him overwhelm Black briefly, but the paired plan survives individual superiority.",
                    "Zamasu calls annihilation justice because he has removed every mortal voice from the definition. Vegeta turns anger into disciplined pressure, while Trunks must fight enemies built from stolen identity and corrupted divinity.",
                    "A plan can be internally consistent and morally empty. Whose experience has been excluded from the principle you are using to justify action?",
                    ["goku-black", "future-zamasu", "goku", "vegeta", "future-trunks"], ["zero-mortal-plan", "body-theft", "immortality", "corrupted-justice"]
                ],
                [
                    "preclimax", 0.78, "Mafuba, Potara, and the Sword of Hope",
                    "Trunks learns the Mafuba from Piccolo's recorded instruction and seals Zamasu, but the missing paper talisman lets the immortal escape. Black and Zamasu fuse with Potara into Fused Zamasu. Goku and Vegeta answer as Vegito Blue, whose power damages the fused god before their union ends early. Trunks gathers energy from the survivors into his sword and splits Zamasu's body apart.",
                    "Trunks keeps converting inherited techniques into future resistance, even when one missing detail ruins the first attempt. Vegito creates an opening; the people who endured the ruined world supply the force behind Trunks's strike.",
                    "A near-complete procedure can still fail at one overlooked dependency. What checklist item protects the effort that every dramatic step is built upon?",
                    ["future-trunks", "piccolo", "future-zamasu", "goku-black", "vegito", "future-mai"], ["mafuba", "fused-zamasu", "vegito-blue", "sword-of-hope"]
                ],
                [
                    "resolution", null, "Zeno Erases the Future",
                    "Zamasu's physical form falls, but his immortality spreads through the sky and begins merging with the timeline itself. Conventional attacks have no single body left to target. Goku remembers the button given to him by Zeno and summons the future Omni-King, who erases Zamasu along with the entire corrupted timeline. Goku, Vegeta, Trunks, Mai, and the time machine escape just before nothing remains.",
                    "Goku uses the last authority available, but the solution cannot distinguish the world Trunks loved from the corruption consuming it. Trunks and Mai survive a victory whose cost includes every place they meant to save.",
                    "Some resolutions prevent further harm without restoring what was lost. How will you acknowledge the cost instead of using success language to hide it?",
                    ["infinite-zamasu", "goku", "future-zeno", "future-trunks", "future-mai", "vegeta"], ["zeno", "timeline-erased", "escape", "resolution"]
                ],
                [
                    "mastery", null, "Hope in Another Branch",
                    "Whis offers Trunks and Mai a home in another version of their future before Zamasu's attack, warning that versions of themselves already live there. They accept the imperfect refuge and say farewell to the present. Goku brings Future Zeno to meet the present Zeno, while Trunks leaves carrying memory of a timeline no one can rebuild or replace.",
                    "Trunks's courage is no longer measured by saving everything; it is measured by continuing after that became impossible. Mai chooses the same complicated future, preserving partnership when place and history are gone.",
                    "Mastery after irreversible loss is not pretending the replacement is equal. What values and relationships can you carry forward without denying what cannot return?",
                    ["future-trunks", "future-mai", "whis", "goku", "future-zeno", "zeno"], ["farewell", "new-timeline", "grief", "mastery"]
                ]
            ])
        },

        dbs_universe_survival: {
            id: "dbs_universe_survival",
            title: "The Tournament of Power",
            series: "DBS",
            continuity: "super_anime",
            sourceNote: "Dragon Ball Super anime episodes 77-131, covering the Zeno Expo, recruitment, Tournament of Power, and Android 17's wish.",
            sourceScope: { animeEpisodes: "77-131", adaptation: "Dragon Ball Super television continuity" },
            entries: makeEntries("dbs_universe_survival", "super_anime", [
                [
                    "entry", 0, "A Tournament with Erasure at Stake",
                    "Goku reminds Zeno of the promised multiverse tournament. The Grand Minister stages an exhibition between Universes 7 and 9, where Gohan regains his competitive resolve and Goku encounters Bergamo and Top. The Tournament of Power is announced for universes with low mortal levels: teams will fight a battle royal, and every losing universe will be erased.",
                    "Goku sees an unmatched contest before understanding the political stakes his reminder activates. Gohan responds differently, recognizing that preparation now serves every life in his universe rather than personal improvement alone.",
                    "Enthusiasm can trigger consequences outside your view. What stakeholders and failure costs should be understood before turning an idea into a commitment?",
                    ["goku", "zeno", "grand-minister", "gohan", "bergamo", "top"], ["zeno-expo", "erasure", "battle-royal", "stakes"]
                ],
                [
                    "development", 0.1, "Ten Fighters for Universe 7",
                    "Goku recruits Vegeta, Gohan, Piccolo, Krillin, Android 18, Android 17, Master Roshi, Tien, and Majin Buu. When Buu falls into a deep sleep, Goku arranges for Frieza to return from the afterlife for twenty-four hours. The team forms from former enemies, retired masters, family protectors, and reluctant allies, with little time to build a shared plan.",
                    "Gohan accepts leadership and emphasizes coordination, while Frieza joins for his own survival and promised resurrection. Android 17 commits after learning the scale of the threat, bringing calm resourcefulness rather than nostalgia.",
                    "A crisis team may not share trust or motives. Which rules and roles are enough to cooperate before deeper alignment becomes possible?",
                    ["goku", "gohan", "vegeta", "piccolo", "krillin", "android-18", "android-17", "master-roshi", "tien-shinhan", "frieza"], ["team-universe-7", "recruitment", "frieza", "leadership"]
                ],
                [
                    "development", 0.2, "The World of Void",
                    "Eight universes assemble eighty fighters on a platform in the World of Void. Flight is restricted, killing is forbidden, and ring-outs decide elimination. Frieza tests the boundaries of loyalty before arriving, but chooses the tournament over a failed bargain with Universe 9. Goku meets Jiren, whose stillness and speed reveal the opponent everyone will eventually have to solve.",
                    "The rules transform enormous power into positioning, endurance, and restraint. Frieza is useful precisely because his self-interest is predictable for now, while Jiren conserves action until action is necessary.",
                    "Constraints do not reduce complexity; they relocate it. Which familiar strength becomes less important when the real objective is position rather than damage?",
                    ["goku", "frieza", "jiren", "top", "zeno", "grand-minister"], ["world-of-void", "rules", "jiren", "positioning"]
                ],
                [
                    "development", 0.3, "The First Universe Falls",
                    "The battle royal begins in confusion, but Universe 7 resists Gohan's formation and separates into smaller fights. Goku and Vegeta help eliminate the Trio de Dangers, and Universe 9 loses all ten members first. Zeno immediately erases their universe, turning the announced stakes into visible reality. Every remaining fighter must continue while understanding that an entire cosmos can vanish between exchanges.",
                    "Gohan's plan is sound but cannot survive teammates who value individual instinct. The first erasure gives abstract risk a human face and forces even confident competitors to absorb what losing means.",
                    "A consequence becomes different once witnessed. What behavior should change now that the cost is evidence rather than a warning?",
                    ["goku", "vegeta", "gohan", "bergamo", "zeno"], ["universe-9", "first-erasure", "battle-royal", "consequences"]
                ],
                [
                    "development", 0.4, "Masters, Androids, and Sacrifices",
                    "Universe 7's less celebrated members prove essential. Krillin uses tactics and teamwork with Android 18 before Frost catches him off guard. Tien sacrifices his remaining clones to take the sniper Harmira out with him. Master Roshi defeats opponents whose illusions and techniques reward experience, nearly dying from the effort before Goku revives him. Each contribution removes threats the strongest fighters never face.",
                    "Roshi's value lies in reading people and techniques, not matching divine power. Tien converts an inevitable ring-out into mutual elimination, while Krillin's lapse shows that success can immediately attract a new angle of attack.",
                    "Team value is not ranked by who fights the final opponent. Which overlooked task must be completed so others can reach the endgame at all?",
                    ["krillin", "android-18", "tien-shinhan", "master-roshi", "goku", "frost", "harmira"], ["master-roshi", "tien", "krillin", "team-contribution"]
                ],
                [
                    "development", 0.5, "The First Sign of Ultra Instinct",
                    "Goku challenges Jiren and climbs through his strongest forms before building a Spirit Bomb from Universe 7's energy. Jiren drives it back, and the resulting collapse appears to erase Goku. He returns moving through Ultra Instinct Sign, his body evading without conscious command. The state lets him surprise Jiren but fades before he can convert defense and movement into a lasting victory.",
                    "Goku reaches the state only after his deliberate options collapse, and even then instinctive attack lags behind instinctive defense. Jiren remains controlled, revealing no panic when an impossible opponent returns changed.",
                    "A breakthrough state is not yet a mastered skill. Which half of the ability works naturally, and which still needs deliberate practice?",
                    ["goku", "jiren", "vegeta", "frieza"], ["spirit-bomb", "ultra-instinct-sign", "jiren", "breakthrough"]
                ],
                [
                    "development", 0.6, "Universe 6's Last Surge",
                    "Hit traps Jiren within an evolving Time-Skip strategy but is eliminated when Jiren breaks through it. Later, Goku fights the rapidly improving Saiyans Caulifla and Kale, who fuse into Kefla with Potara. Kefla's power forces Goku back into Ultra Instinct Sign. He evades her final attack and rides a Kamehameha along its edge, eliminating the fusion and ending Universe 6's strongest remaining chance.",
                    "Hit spends his tournament on a plan that gives weaker teammates a possible future, even though it costs him. Caulifla and Kale turn trust into explosive growth, pushing Goku through exhaustion toward another breakthrough.",
                    "A teammate's final effort can create time rather than victory. How will you use the opening someone else paid to provide?",
                    ["hit", "jiren", "goku", "caulifla", "kale", "kefla"], ["time-skip", "kefla", "ultra-instinct-sign", "universe-6"]
                ],
                [
                    "development", 0.7, "The Field Narrows",
                    "Gohan and Piccolo defeat Universe 6's fused Namekians after recognizing the many lives joined within them, and Universe 6 is erased once its final fighters fall. Android 18 sacrifices her position to keep Android 17 in the tournament. Universe 2's coordinated transformations and Universe 4's hidden fighters also fail, leaving fewer universes and less space for mistakes as the time limit approaches.",
                    "Piccolo and Gohan combine patient analysis with trust built across years. Android 18 chooses the teammate whose unlimited stamina offers the stronger endgame, making sacrifice a calculation rather than a gesture.",
                    "Good teamwork includes deciding which capability must remain active. If only one role can continue, what objective evidence should guide the choice?",
                    ["gohan", "piccolo", "android-18", "android-17", "saonel", "pilina"], ["universe-6-erased", "namekians", "androids", "endgame"]
                ],
                [
                    "preclimax", 0.82, "Universe 7 Versus Universe 11",
                    "Universe 3's Anilaza forces Universe 7's remaining fighters into rare total cooperation before Android 17 strikes its energy core. With only Universes 7 and 11 left, Gohan accepts elimination to help Frieza remove Dyspo. Vegeta defeats Top after rejecting destruction without principle, then gives his last energy to Goku before Jiren knocks him out. Android 17 appears to sacrifice himself protecting them.",
                    "The field narrows through deliberate exchanges: Gohan trades himself for speed, Vegeta spends pride as fuel for another fighter, and 17 chooses protection when his own survival looks impossible.",
                    "Preclimax decisions are often resource transfers. What strength, position, or credit should you spend now so the team retains a viable final move?",
                    ["android-17", "anilaza", "gohan", "frieza", "dyspo", "vegeta", "top", "goku", "jiren"], ["anilaza", "universe-11", "toppo", "sacrifice"]
                ],
                [
                    "resolution", null, "The Last Three of Universe 7",
                    "Goku completes Ultra Instinct and overwhelms Jiren, but the form collapses before the ring-out. Frieza returns to attack, and Android 17 reveals he survived beneath the rubble. Goku and Frieza combine their remaining strength, carrying Jiren out while falling with him. Android 17 stands as the final competitor, making Universe 7 the winner through survival, restraint, and cooperation between former enemies.",
                    "Goku's highest individual state cannot finish the tournament, so the decisive action belongs to a base-form partnership with Frieza and 17's quiet endurance. Jiren finally receives strength through trust rather than isolation.",
                    "Resolution may arrive after peak performance fails. Can you return to basic cooperation without treating it as lesser than the breakthrough you lost?",
                    ["goku", "frieza", "android-17", "jiren"], ["mastered-ultra-instinct", "final-ring-out", "universe-7-wins", "resolution"]
                ],
                [
                    "mastery", null, "Android 17's Wish",
                    "Super Shenron offers Android 17 the tournament's prize. Instead of taking the cruise he wanted, 17 wishes every erased universe back into existence. The Grand Minister explains that Zeno expected a virtuous winner and would have erased everything if the final wish were selfish. Beerus arranges Frieza's permanent revival, and the restored teams return home carrying new rivals, debts, and friendships.",
                    "Android 17's calm independence culminates in universal restoration without ceremony. Frieza receives life because his self-interest was temporarily harnessed to collective survival, not because anyone mistakes him for reformed.",
                    "Mastery turns the largest available reward outward. If success gave you more choice than expected, what restoration would matter beyond your original goal?",
                    ["android-17", "super-shenron", "grand-minister", "zeno", "frieza", "beerus", "goku"], ["super-shenron", "universes-restored", "frieza-revived", "mastery"]
                ]
            ])
        },

        dbs_galactic_patrol: {
            id: "dbs_galactic_patrol",
            title: "The Galactic Patrol Prisoner",
            series: "DBS",
            continuity: "super_manga",
            sourceNote: "Dragon Ball Super manga chapters 42-67, from Moro's escape through the Galactic Patrol epilogue; the Granolah raid later in chapter 67 is excluded.",
            sourceScope: { mangaChapters: "42-67", boundary: "Ends with the Moro epilogue before Granolah's OG73 raid in chapter 67." },
            entries: makeEntries("dbs_galactic_patrol", "super_manga", [
                [
                    "entry", 0, "The Patrol Takes Majin Buu",
                    "Galactic Patrol agents arrive on Earth and take Majin Buu because the dormant Grand Supreme Kai within him once fought an ancient prisoner named Moro. Goku and Vegeta pursue, but elite patrolman Merus incapacitates them and explains the crisis. Moro has escaped after ten million years in custody, and the Patrol needs both Buu's sealed power and the Saiyans' strength to recapture him.",
                    "Merus controls the encounter without unnecessary harm, immediately challenging the Saiyans' assumptions about the Patrol. Goku and Vegeta accept temporary badges because the threat requires information and jurisdiction beyond Earth's defenders.",
                    "Joining an unfamiliar institution can extend your reach without surrendering judgment. What expertise or authority does the mission need that your usual team lacks?",
                    ["goku", "vegeta", "merus", "majin-buu", "moro", "jaco"], ["galactic-patrol", "moro", "grand-supreme-kai", "recruitment"]
                ],
                [
                    "development", 0.12, "Moro Feeds on New Namek",
                    "Moro and the escaped Frieza Force deserter Cranberry travel to New Namek for its Dragon Balls. Goku and Vegeta confront the weakened wizard and initially overpower him, but Moro drains life energy from the planet and from their bodies. Their transformations collapse as his strength returns. The planet itself becomes his resource, making prolonged combat an advantage for the enemy rather than the heroes.",
                    "Vegeta recognizes another threat exploiting Namek and fights with unusual protective urgency. Moro avoids matching force directly; he changes the resource economy until stronger opponents cannot afford to remain stronger.",
                    "A contest can be lost through its resource model rather than its visible exchanges. What is the other side gaining each minute you continue?",
                    ["moro", "cranberry", "goku", "vegeta", "new-namekians"], ["new-namek", "energy-absorption", "dragon-balls", "resource-model"]
                ],
                [
                    "development", 0.24, "Three Wishes and a Prison Break",
                    "Majin Buu awakens with the Grand Supreme Kai's personality and presses Moro using ancient divine power. During their battle, Cranberry summons Porunga and uses the first wish to heal himself, then the second to restore Moro's full magic. Moro kills Cranberry before the agreed escape wish and uses the final wish to release every Galactic Prison inmate. His renewed army arrives as New Namek is consumed.",
                    "Cranberry bargains with someone who treats every agreement as temporary leverage and learns too late that shared criminal interest is not trust. The Grand Supreme Kai returns to a fight whose old sacrifice remains unfinished.",
                    "A deal without enforceable limits depends entirely on character. What evidence suggests a partner will honor the agreement after gaining what they need?",
                    ["majin-buu", "grand-supreme-kai", "moro", "cranberry", "porunga"], ["porunga", "moro-magic", "prison-break", "betrayal"]
                ],
                [
                    "development", 0.36, "Two Different Training Roads",
                    "After retreating, Goku asks Merus to train him toward complete Ultra Instinct inside a Galactic Patrol time chamber. Vegeta travels to Yardrat, seeking techniques rather than another transformation, and studies spirit control under Pybara. Their paths separate around different flaws: Goku must quiet emotion into autonomous movement, while Vegeta must refine control enough to undo energy that Moro has stolen or combined.",
                    "Merus proves to be more than an officer, matching Goku with angelic precision he cannot explain openly. Vegeta chooses the world associated with Goku's teleportation and humbly begins with fundamentals he once dismissed.",
                    "Different weaknesses deserve different training plans. Are you copying a teammate's solution when your actual bottleneck requires another discipline?",
                    ["goku", "merus", "vegeta", "pybara"], ["ultra-instinct", "yardrat", "spirit-control", "training"]
                ],
                [
                    "development", 0.48, "Moro's Army Reaches Earth",
                    "Moro feeds across the galaxy while his freed prisoners raid worlds and Seven-Three copies abilities for later use. When the army reaches Earth, Gohan, Piccolo, Krillin, Android 17, Android 18, Tien, Chiaotzu, Yamcha, and the Galactic Patrol fight separate threats before Goku and Vegeta return. Their defense prevents quick conquest and exposes the copied techniques Moro's side intends to exploit.",
                    "Earth's fighters organize around matchups instead of waiting for Saiyan rescue. Gohan and Piccolo turn their history against Seven-Three's copied arsenal, while Yamcha reclaims a practical role protecting weaker patrol teams.",
                    "Prepared depth buys time against a distributed threat. Which secondary team needs authority now rather than instructions to wait for the specialists?",
                    ["moro", "seven-three", "gohan", "piccolo", "krillin", "android-17", "android-18", "tien-shinhan", "yamcha"], ["earth-invasion", "seven-three", "galactic-prisoners", "distributed-defense"]
                ],
                [
                    "development", 0.62, "Sign and Spirit Fission",
                    "Goku returns with improved Ultra Instinct Sign and battles Moro, but the unstable state expires before he can finish. Vegeta then arrives from Yardrat using Forced Spirit Fission, separating the life energy Moro stole and returning it to its sources. The wizard weakens until he consumes Seven-Three, gaining the android's stored copies and a younger, more powerful body that reverses Vegeta's advantage.",
                    "Goku's progress is real but still time-limited. Vegeta's new technique repairs victims while weakening the enemy, showing growth beyond damage; Moro responds by consuming a subordinate kept as a reserve resource.",
                    "The best solution may restore what was taken rather than add more force. What repair mechanism attacks the problem and heals its consequences together?",
                    ["goku", "moro", "vegeta", "seven-three"], ["ultra-instinct-sign", "forced-spirit-fission", "moro-seven-three", "restoration"]
                ],
                [
                    "preclimax", 0.78, "Merus Breaks Angel Law",
                    "Moro uses Seven-Three's copying power to overwhelm the defenders and targets their abilities through crystals on his body. Merus returns despite the Angel law forbidding him from fighting for one side. He destroys Moro's copying crystals and completes Goku's lesson through deliberate sacrifice. As his angelic existence fades, Merus leaves Goku with grief that must be accepted without losing the calm Ultra Instinct requires.",
                    "Merus chooses the justice he learned among mortals over neutral existence, fully aware of the price. Goku honors him not by suppressing emotion, but by letting purpose settle emotion into clarity.",
                    "Control is not numbness. Can grief inform your next action without seizing the movement that action requires?",
                    ["merus", "moro", "goku", "whis"], ["angel-law", "merus-sacrifice", "copy-crystals", "preclimax"]
                ],
                [
                    "resolution", null, "The Planet-Eater Becomes the Planet",
                    "Goku perfects Ultra Instinct and defeats Moro, but mercy gives the wizard time to attach a severed hand carrying Merus's copied power. Unable to contain angelic energy, Moro merges with Earth and threatens to explode. Vegeta gathers separated energy from their allies, and divine power from the distant child Uub replenishes Goku. A giant ki avatar shatters Moro's forehead crystal and ends him.",
                    "Goku's mercy becomes dangerous when offered without a containment plan. Vegeta turns his new skill toward collective support, while Uub contributes power he does not yet understand to save a world that does not know him.",
                    "Resolution may require help from outside the visible team. What contribution can your system receive without needing its source to be famous or fully informed?",
                    ["goku", "moro", "vegeta", "uub", "grand-supreme-kai"], ["perfected-ultra-instinct", "earth-merged-moro", "uub", "resolution"]
                ],
                [
                    "mastery", null, "Justice Beyond Angelhood",
                    "The Grand Minister restores Merus as a mortal after Supreme Kai and the Grand Supreme Kai plead for him, allowing him to continue serving the Galactic Patrol without angelic power. The Patrol honors Goku, Vegeta, Buu, and their allies. Uub remains unaware of the divine strength he supplied. Peace returns with new techniques, repaired worlds, and a former angel freely committed to mortal justice.",
                    "Merus loses cosmic status but keeps the vocation he chose, revealing that purpose was never identical to power. Goku and Vegeta leave with complementary lessons in calm mastery and restorative control.",
                    "Mastery is keeping the purpose when rank or extraordinary ability changes. What work would still matter to you if its prestige disappeared?",
                    ["merus", "grand-minister", "supreme-kai", "grand-supreme-kai", "goku", "vegeta", "uub"], ["merus-restored", "galactic-patrol", "uub", "mastery"]
                ]
            ])
        },

        dbs_granolah: {
            id: "dbs_granolah",
            title: "Granolah the Survivor",
            series: "DBS",
            continuity: "super_manga",
            sourceNote: "Dragon Ball Super manga chapters 67-87, beginning with Granolah's OG73 raid after the Moro epilogue and ending with Black Frieza.",
            sourceScope: { mangaChapters: "67-87", boundary: "Begins with Granolah's raid after the Galactic Patrol epilogue in chapter 67." },
            entries: makeEntries("dbs_granolah", "super_manga", [
                [
                    "entry", 0, "The Cerealian Who Hates Saiyans",
                    "Months after Moro's defeat, Cerealian bounty hunter Granolah raids Goichi's ship and steals the dormant OG73 for the Heeters. Data recovered from the android helps Elec's family learn about Goku, Vegeta, and the Dragon Balls. Granolah then hears that Frieza has returned. As the sole survivor of a world attacked by Saiyans under Frieza's command, he sees one remaining purpose: revenge.",
                    "Granolah has compressed survival into a single future act, allowing the Heeters to direct his grief through selective information. Elec values both Granolah and OG73 only as tools in a larger power bid.",
                    "A narrow purpose can create endurance while making manipulation easier. Who benefits from the version of the story currently driving your effort?",
                    ["granolah", "og73", "elec", "oil", "macki", "gas", "frieza"], ["cerealian", "heeters", "og73", "revenge"]
                ],
                [
                    "development", 0.12, "The Strongest at the Cost of a Life",
                    "Granolah gathers Planet Cereal's two Dragon Balls and asks Toronbo to make him the universe's strongest warrior. The dragon cannot grant power beyond Granolah's lifetime potential, but offers to condense nearly all of that future into the present. Granolah accepts, leaving only three years to live. He gains extraordinary precision and techniques, then demands that the Heeters reveal Frieza's location.",
                    "Granolah treats years of possible life as currency because revenge has displaced every other imagined future. Toronbo states the cost plainly, making the wish informed but not necessarily wise.",
                    "A transparent cost can still support a destructive choice. What future possibility have you undervalued because one urgent goal occupies the whole horizon?",
                    ["granolah", "toronbo", "monaito", "elec"], ["cerealian-dragon-balls", "strongest-warrior", "lifespan", "tradeoff"]
                ],
                [
                    "development", 0.24, "The Heeters Arrange a Collision",
                    "Elec decides Granolah's new strength threatens the Heeters' plan to control Frieza's empire. Macki and Oil tell Granolah that Goku and Vegeta are Frieza's Saiyan assassins, while separately asking the Saiyans to stop a supposed villain on Planet Cereal. As both sides travel toward the same battlefield, Goku has been refining Ultra Instinct with Whis and Vegeta learning Destruction from Beerus.",
                    "The Heeters do not overpower either side; they control context so each supplies its own aggression. Goku and Vegeta arrive with genuine growth but rely on a mission description they have not independently verified.",
                    "Improved ability does not protect against false framing. Which key claim should you verify before committing your strongest response?",
                    ["elec", "macki", "oil", "granolah", "goku", "vegeta", "whis", "beerus"], ["heeter-deception", "ultra-instinct", "destruction", "false-framing"]
                ],
                [
                    "development", 0.36, "Precision Against Instinct",
                    "Granolah attacks Goku and Vegeta across the ruins of Planet Cereal, targeting vital points with his enhanced right eye. Goku reaches perfected Ultra Instinct, but Granolah reveals that much of the battle used a clone and strikes the real Goku when his accuracy declines. Vegeta studies the destroyed city, recognizes a survivor's anger, and forces the conflict toward truths their hosts concealed.",
                    "Granolah's precision punishes even tiny lapses, while Goku learns that a perfected state still changes with stamina and focus. Vegeta reads history in the terrain before he understands the person attacking him.",
                    "Peak performance is not permanent performance. What happens to your strategy when accuracy degrades after the first impressive phase?",
                    ["granolah", "goku", "vegeta"], ["planet-cereal", "vital-points", "ultra-instinct", "clone"]
                ],
                [
                    "development", 0.48, "Ultra Ego and a Ruined Home",
                    "Vegeta confronts Granolah and unveils Ultra Ego, a Destruction-trained form that turns battle damage and fighting spirit into greater power. The exchange grows increasingly self-destructive as Granolah adapts to his condensed strength. Vegeta refuses to carry Frieza's crimes as his own, yet acknowledges the Saiyan history before them. Both fighters approach a final attack that could spend the lives they claim to defend.",
                    "Vegeta's new form fits his nature but also tempts him to mistake accumulated harm for limitless momentum. Granolah sees any surviving Saiyan as the target his lost people are owed.",
                    "A strength that rewards damage still needs a stopping rule. What signal tells you that endurance has become self-destruction rather than courage?",
                    ["vegeta", "granolah", "goku"], ["ultra-ego", "destruction", "saiyan-history", "self-destruction"]
                ],
                [
                    "development", 0.62, "Bardock's Mercy and Elec's Crime",
                    "Monaito interrupts the battle and reveals that Bardock protected Granolah and his mother Muezli during the Saiyan assault. The Heeters, not Bardock, pursued them afterward, and Elec killed Muezli. Granolah's memory and revenge narrative fracture just as the Heeters arrive. Elec uses the Cerealian Dragon Balls to make Gas the new strongest warrior, paying a hidden price in his youngest brother's lifespan.",
                    "Monaito withheld the truth to protect Granolah from more pain, but silence left him vulnerable to a more useful lie. Elec treats Gas's remaining life as an asset he owns and spends without disclosure.",
                    "Protective silence can create an information vacuum. Which painful truth is safer when shared by someone trustworthy than discovered through manipulation?",
                    ["monaito", "granolah", "bardock", "muezli", "elec", "gas", "toronbo"], ["bardock", "muezli", "gas-wish", "truth"]
                ],
                [
                    "preclimax", 0.78, "Bardock's Voice Across Forty Years",
                    "Gas overwhelms the exhausted fighters, first in a berserk state and then with controlled power. Goku uses Instant Teleportation across distant worlds to strand him temporarily, buying time at Monaito's home. A recovered scouter plays Bardock's battle with Gas from forty years earlier. Hearing his father's determination helps Goku accept his own nature and shape an emotional, personal version of Ultra Instinct for Gas's return.",
                    "Bardock's legacy reaches Goku as effort rather than reputation: a low-class Saiyan refusing to stop. Goku advances by integrating memory and feeling, not by imitating an angel's emotional distance perfectly.",
                    "A model becomes useful when translated through your own nature. What principle should you adapt rather than copy exactly?",
                    ["gas", "goku", "bardock", "monaito", "vegeta"], ["instant-teleportation", "bardock-recording", "true-ultra-instinct", "preclimax"]
                ],
                [
                    "resolution", null, "Black Frieza",
                    "Goku, Vegeta, Monaito, and the recovered Granolah combine their efforts until Granolah's charged blast appears to defeat Gas. Elec forces his dying brother back into battle, but Frieza arrives, kills Gas, and eliminates Elec after revealing he knew the Heeters' scheme. Ten years of training in another dimension produced Black Frieza, who drops Ultra Instinct Goku and Ultra Ego Vegeta with single blows before departing.",
                    "Elec spends Gas to the final second and discovers Frieza was never the uninformed target he imagined. Frieza spares the Saiyans because they are not his present objective, making restraint more unsettling than mercy.",
                    "Resolution can expose a larger horizon rather than crown the strongest participant. Which assumption fails when an outside actor has been preparing beyond your measurement?",
                    ["granolah", "gas", "elec", "frieza", "goku", "vegeta", "monaito"], ["gas-defeated", "black-frieza", "heeters-fall", "resolution"]
                ],
                [
                    "mastery", null, "Three Years Used Differently",
                    "Whis heals Monaito, and Frieza takes Oil and Macki into his service before leaving Planet Cereal. Granolah abandons revenge and intends to use his remaining three years to repair the world and relationships his anger endangered. Goku keeps Bardock's scouter as a link to the father he barely knew, while he and Vegeta return to training with a clearer view of both their inheritance and their unfinished limits.",
                    "Granolah cannot reclaim the lifespan traded away, but he can change what the remaining time serves. Goku and Vegeta leave without pretending Frieza's superiority erased the insight earned on Cereal.",
                    "Mastery is choosing the use of a limited future after the original goal collapses. What repair deserves the time you can no longer spend on revenge?",
                    ["granolah", "monaito", "whis", "goku", "vegeta", "oil", "macki", "frieza"], ["remaining-lifespan", "bardock-scouter", "repair", "mastery"]
                ]
            ])
        }
    });
})();
