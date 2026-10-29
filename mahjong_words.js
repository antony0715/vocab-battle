// ==================== 🀄 麻將專用補充單字 (mahjong_words.js) ====================
// 只給英文麻將判定單字用（不會出現在一般題庫、也不會影響各級題庫與個人檔案統計）。
// 之後想補字，直接把單字加進下面任一行（用空格隔開、全小寫）即可。
const mjExtraWords = (`
cat dog pig cow hen fox bat rat ant bee owl ape elk yak emu cub pup ram ewe lamb sheep horse mouse mice goat duck goose
swan crow dove hawk eagle robin finch parrot lion tiger bear wolf deer frog toad snake lizard turtle shark whale seal otter
beaver rabbit hare squirrel monkey zebra giraffe camel panda koala kangaroo hippo rhino moose bison buffalo donkey pony puppy
kitten chick chicken rooster turkey peacock penguin ostrich crab fish trout salmon tuna squid octopus snail slug worm spider
moth fly flea tick wasp beetle cricket butterfly ladybug dragonfly dolphin walrus leopard cheetah jaguar lynx badger skunk mole
bull calf foal cattle insect bird bug pet cage nest wing wings tail paw claw fur feather horn
one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen
twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million zero first second third fourth fifth half double triple
apple pear plum peach grape grapes lemon lime melon mango banana cherry berry orange papaya guava lychee kiwi fig date olive
coconut pineapple apricot pomelo tomato corn pea peas bean beans carrot onion potato garlic ginger lettuce cabbage celery pepper
pumpkin radish spinach turnip beet broccoli cucumber mushroom fruit vegetable
red blue green yellow pink purple brown black white gray grey gold silver tan color
mom dad mum mother father sister brother son aunt uncle baby kid kids boy girl man woman men women wife husband grandma grandpa
family cousin friend friends parent parents child children
head hair face eye eyes ear ears nose mouth lip lips tooth teeth tongue neck arm arms hand hands finger fingers thumb leg legs knee
foot feet toe toes back chest heart belly skin bone brain body shoulder elbow
rice bread milk egg eggs meat beef pork ham bacon soup salad cake cookie candy pizza pasta noodle noodles butter cheese sugar salt
honey jam juice tea coffee water soda snack lunch dinner breakfast cream pie nut nuts fries burger sandwich chip chips food meal
dish bowl cup glass plate fork spoon knife bottle
sun moon star stars sky cloud clouds rain snow wind storm fog ice hot cold warm cool sunny rainy windy cloudy snowy tree trees leaf
leaves flower flowers rose grass seed river lake sea ocean beach hill mountain rock stone sand field forest island pond wave fire
earth weather plant plants
day days week weeks month months year years today night morning evening noon hour minute time monday tuesday wednesday thursday
friday saturday sunday january february march april may june july august september october november december spring summer autumn fall winter
book books pen pencil ruler desk chair class teacher student school bag paper map board chalk eraser lesson test exam math read
write draw sing song game play toy toys ball
home house room door window wall floor roof bed table sofa lamp clock phone radio fan key box bath shower kitchen garden yard garage
hat cap shirt coat dress skirt pants jeans shoe shoes sock socks boot boots scarf glove gloves belt tie suit jacket sweater
car bus train bike taxi boat ship plane jet truck van road street bridge station airport
park zoo farm shop store market bank hotel hospital library museum cinema theater city town village country
doctor nurse cook chef farmer driver pilot police singer dancer artist writer actor clerk baker
big small tall short long fat thin new old young good bad happy sad angry tired hungry thirsty fast slow clean dirty soft hard sweet
sour salty bitter quiet loud easy busy free full empty open close nice kind cute funny lucky
run walk jump swim fly eat drink sleep sit stand come see look hear listen say tell ask give take make have get put let help love
like want need use try work wash cook cut dig fix hug kick kiss laugh cry smile
yes not and the for but you she her him his its our out all any can had has was are who why how now then than that this with from
they them what when where which here there very too also just
am an as at be by do go he hi if in is it me my no of oh on or ox so to up us we ah antony zombie birth ass fuck sue hairstyle ntr acne menu dice nope ride europe european
`).split(/\s+/).filter(w => /^[a-z]{2,}$/.test(w));
