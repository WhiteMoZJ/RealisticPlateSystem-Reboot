import { DependencyContainer } from "tsyringe";
import { IPostDBLoadMod } from "@spt-aki/models/external/IPostDBLoadMod";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { JsonUtil } from "@spt-aki/utils/JsonUtil";
import { IDatabaseTables } from "@spt-aki/models/spt/server/IDatabaseTables";
import { ILocaleBase } from "@spt-aki/models/spt/server/ILocaleBase";
import { ITemplateItem } from "@spt-aki/models/eft/common/tables/ITemplateItem";
import translations from "./translations.json";

let Logger: ILogger;
let database: IDatabaseTables;
let jsonUtil: JsonUtil;
let items: Record<string, ITemplateItem>;
let Plates = [] as string[];
let FullPlates = [] as string[];
let scavPlates = [] as string[];
let scavFullPlates = [] as string[];
let bossPlates = [] as string[];
let bossFullPlates = [] as string[];
let locales: ILocaleBase;
// let translations: Record<string, Record<string, string>>

export const level: Record<number, string> =
{
    3: "Ⅲ",
    4: "Ⅳ",
    5: "Ⅴ",
    6: "Ⅵ"
    // you can add more if you need
};

export const levelColor: Record<number, string> = 
{
    3: "green",
    4: "blue",
    5: "violet",
    6: "red"
};

const config = require("../config.json") as IConfig;
const weightRetainPer = 0.2;

class plates implements IPostDBLoadMod {
    public postDBLoad(container: DependencyContainer): void
    {
        Logger = container.resolve<ILogger>("WinstonLogger");
        database = container.resolve<DatabaseServer>("DatabaseServer").getTables();
        jsonUtil = container.resolve<JsonUtil>("JsonUtil");
        items = database.templates.items;
        locales = database.locales;

        Logger.info("[WM-RPSR] Generating stuffs");
        try {
            this.createHandbookCat();
            this.createPlates();
            this.tweakCarriers();
            this.createContainer();
            this.tweakAmmoDamage();
        } catch (e) {
            Logger.error(`[WM-RPSR] Unable to generate, exception thrown => ${e}`);
        }
        finally {
            Logger.info("[WM-RPSR] Done Generating");
        }
    }

    public createHandbookCat(): void
    {
        database.templates.handbook.Categories.push(
            {
                "Id": "plate_category",
                "ParentId": "5b47574386f77428ca22b33f",
                "Icon": "/files/handbook/icon_gear_components.png",
                "Color": "",
                "Order": "100"
            });
        for (const lang in translations) {
            locales.global[lang]["plate_category"] = translations[lang]["Armor Plates"];
        }
            
    }

    public createContainer(): void
    {
        let plateContainer = jsonUtil.clone(items["59fb042886f7746c5005a7b2"]);
        plateContainer._id = "plateContainer";
        plateContainer._props.Height = 3;
        plateContainer._props.Weight = 2.25;
        plateContainer._props.Prefab.path = "assets/content/items/spec/item_spec_armorrepair/item_spec_armorrepair.bundle";
        plateContainer._props.ItemSound = "spec_armorrep";
        plateContainer._props.Grids[0]._props.filters[0].Filter = FullPlates;

        items[plateContainer._id] = plateContainer
        for (const lang in translations) {
            locales.global[lang]["plateContainer Name"] = translations[lang]["Bag"];
            locales.global[lang]["plateContainer ShortName"] = translations[lang]["Bag_s"];
            locales.global[lang]["plateContainer Description"] = translations[lang]["BagDescription"];
        }
        

        database.templates.handbook.Items.push(
            {
                "Id": "plateContainer",
                "ParentId": "5b5f6fa186f77409407a7eb7",
                "Price": 350000,
            }
        );

        database.traders["5ac3b934156ae10c4430e83c"].assort.items.push(
            {
                "_id": "plateContainer",
                "_tpl": "plateContainer",
                "parentId": "hideout",
                "slotId": "hideout",
                "upd": {
                    "StackObjectsCount": 99999999,
                    "BuyRestrictionMax": 2,
                    "UnlimitedCount": true
                }
            }
        );

        database.traders["5ac3b934156ae10c4430e83c"].assort.barter_scheme["plateContainer"] =
            [
                [{
                    _tpl: "5449016a4bdc2d6f028b456f",
                    count: 350000
                }]
            ]

        database.traders["5ac3b934156ae10c4430e83c"].assort.loyal_level_items["plateContainer"] = 2;
    }

    public createPlates(): void
    {
        for (let material in database.globals.config.ArmorMaterials) {
            if (config.GenerationConfig.ChangeMaterialDestructibility) {
                // new destructibility
                let des = database.globals.config.ArmorMaterials[material].Destructibility;
                let exp = database.globals.config.ArmorMaterials[material].ExplosionDestructibility;

                database.globals.config.ArmorMaterials[material].Destructibility = config.MaterialsConfig[material].Destructibility;
                database.globals.config.ArmorMaterials[material].ExplosionDestructibility = config.MaterialsConfig[material].ExplosionDestructibility;

                Logger.success(`[WM-RPSR] Tweaked Materials ${material} Destructibility ${des} -> ${database.globals.config.ArmorMaterials[material].Destructibility}`)
                Logger.success(`[WM-RPSR] Tweaked Materials ${material} ExplosionDestructibility ${exp} -> ${database.globals.config.ArmorMaterials[material].ExplosionDestructibility}`)
            }

            if (material == "Glass") continue; // no glass plate
            if (material == "Aramid") continue; // prepare for arm plates

            for (let i = 3; i <= 6; i++) {
                let loyalLevel =
                    i < 2
                        ? 0
                        : i <= 4
                            ? 1
                            : i <= 5
                                ? 2
                                : 3; // to modified the loyal level of selling different plates

                let materialMult = config.MaterialsConfig[material].WeightMultiplier;
                let materialPenaltyMult = config.MaterialsConfig[material].PenaltyMultiplier;
                let bluntMat = config.MaterialsConfig[material].BluntThroughput;
                let durBase = config.MaterialsConfig[material].DurabilityBase;
                let priceMult = config.MaterialsConfig[material].PriceMultiplier

                if (material == "Aluminium" && i >= 5) continue;
                if (material == "Titan" && i == 3) continue;

                // for plate only protect chest/throax
                let armorPlate = jsonUtil.clone(items["5648a7494bdc2d9d488b4583"])
                armorPlate._id = `plate${i}Chest${material == "ArmoredSteel" ? "Steel" : material}`;
                armorPlate._parent = "57bef4c42459772e8d35a53b";
                if (material == "Combined" || material == "Ceramic" || material == "UHMWPE") {
                    armorPlate._props.Prefab.path = "assets/item_equipment_armorplate_chest_heavy.bundle";
                }
                else {
                    armorPlate._props.Prefab.path = "assets/item_equipment_armorplate_chest_light.bundle";
                }

                armorPlate._props.Height = 2;
                armorPlate._props.Width = 2;
                armorPlate._props.Weight *= i * materialMult * 0.3;
                armorPlate._props.armorClass = i;
                armorPlate._props.armorZone = ["Chest"];
                armorPlate._props.Durability = 40 + durBase + (i * 5);
                armorPlate._props.MaxDurability = armorPlate._props.Durability;
                armorPlate._props.ArmorMaterial = material;
                armorPlate._props.speedPenaltyPercent = i * -0.3 * materialPenaltyMult;
                armorPlate._props.mousePenalty = i * -0.2 * materialPenaltyMult;
                armorPlate._props.weaponErgonomicPenalty = -1;
                armorPlate._props.BluntThroughput = bluntMat;
                if (i >= 3 && i <= 5) {
                    armorPlate._props.BluntThroughput *= 1.25;
                }
                armorPlate._props.ArmorType = i > 4 ? "Heavy" : "Light";
                armorPlate._props.RepairCost = 50 * priceMult;
                armorPlate._props.LootExperience = i;
                armorPlate._props.ItemSound = "gear_helmet";

                if (config.GenerationConfig.TweakBackgroundColor)
                    armorPlate._props.BackgroundColor = levelColor[i];

                items[armorPlate._id] = armorPlate

                for (const lang in translations) {
                    locales.global[lang][`${armorPlate._id} Name`] = `${translations[lang]["PlateName"].split("|")[0]} ${i} ${translations[lang][material]} ${translations[lang]["PlateName"].split("|")[1]}`;
                    locales.global[lang][`${armorPlate._id} ShortName`] = `${level[i]} ${translations[lang][material]} C.`;
                    locales.global[lang][`${armorPlate._id} Description`] = `${translations[lang][material]}${translations[lang]["PlateDescription"].split("|")[0]}${level[i]}${translations[lang]["PlateDescription"].split("|")[1]}`;
                }

                database.templates.handbook.Items.push(
                    {
                        "Id": armorPlate._id,
                        "ParentId": "plate_category",
                        "Price": 4500 * i * priceMult
                    }
                );

                database.traders["5ac3b934156ae10c4430e83c"].assort.items.push(
                    {
                        "_id": armorPlate._id,
                        "_tpl": armorPlate._id,
                        "parentId": "hideout",
                        "slotId": "hideout",
                        "upd": {
                            "StackObjectsCount": 99999999,
                            "BuyRestrictionMax": 30 / i,
                            "UnlimitedCount": true
                        }
                    }
                );

                database.traders["5ac3b934156ae10c4430e83c"].assort.barter_scheme[armorPlate._id] =
                    [
                        [{
                            _tpl: "5449016a4bdc2d6f028b456f",
                            count: 4500 * i * priceMult
                        }]
                    ];

                database.traders["5ac3b934156ae10c4430e83c"].assort.loyal_level_items[armorPlate._id] = loyalLevel;

                if (i <= config.BotGenConfig.MaxScavPlateLevel) {
                    scavPlates.push(armorPlate._id);
                    scavFullPlates.push(armorPlate._id);
                }
                Plates.push(armorPlate._id);
                FullPlates.push(armorPlate._id);

                if (i >= 5) {
                    bossPlates.push(armorPlate._id);
                    bossFullPlates.push(armorPlate._id);
                }

                // for full-size plate, stomach included

                if (material == "UHMWPE" && i == 6) continue;
                let fullArmorPlate = jsonUtil.clone(items["5648a7494bdc2d9d488b4583"]);
                fullArmorPlate._id = `plate${i}FullPlate${material == "ArmoredSteel" ? "Steel" : material}`;
                fullArmorPlate._parent = "57bef4c42459772e8d35a53b";
                if (material == "Aluminum" || material == "Ceramic" || material == "UHMWPE") {
                    fullArmorPlate._props.Prefab.path = "assets/item_equipment_armorplate_full_2.bundle";
                }
                else {
                    fullArmorPlate._props.Prefab.path = "assets/item_equipment_armorplate_full_1.bundle";
                }
                fullArmorPlate._props.Height = 3;
                fullArmorPlate._props.Width = 2;
                fullArmorPlate._props.Weight *= i * materialMult * 0.4;
                fullArmorPlate._props.armorClass = i;
                fullArmorPlate._props.armorZone = ["Chest", "Stomach"];
                fullArmorPlate._props.Durability = 55 + durBase + (i * 5);
                fullArmorPlate._props.MaxDurability = fullArmorPlate._props.Durability;
                fullArmorPlate._props.ArmorMaterial = material;
                fullArmorPlate._props.speedPenaltyPercent = i * -0.4 * materialPenaltyMult;
                fullArmorPlate._props.mousePenalty = i * -0.3 * materialPenaltyMult;
                fullArmorPlate._props.weaponErgonomicPenalty = -1;
                fullArmorPlate._props.BluntThroughput = bluntMat * 0.8;
                if (i >= 3 && i <= 5) {
                    fullArmorPlate._props.BluntThroughput *= 1.25;
                }
                fullArmorPlate._props.ArmorType = i > 3 ? "Heavy" : "Light";
                fullArmorPlate._props.RepairCost = 70 * priceMult;
                fullArmorPlate._props.LootExperience = i;
                fullArmorPlate._props.ItemSound = "container_case";

                if (config.GenerationConfig.TweakBackgroundColor)
                    fullArmorPlate._props.BackgroundColor = levelColor[i];

                items[fullArmorPlate._id] = fullArmorPlate

                for (const lang in translations) {
                    locales.global[lang][`${fullArmorPlate._id} Name`] = `${translations[lang]["FullPlateName"].split("|")[0]} ${i} ${translations[lang][material]} ${translations[lang]["FullPlateName"].split("|")[1]}`;
                    locales.global[lang][`${fullArmorPlate._id} ShortName`] = `${level[i]} ${translations[lang][material]} F.`;
                    locales.global[lang][`${fullArmorPlate._id} Description`] = `${translations[lang][material]}${translations[lang]["FullPlateDescription"].split("|")[0]}${level[i]}${translations[lang]["FullPlateDescription"].split("|")[1]}`;
                }

                database.templates.handbook.Items.push(
                    {
                        "Id": fullArmorPlate._id,
                        "ParentId": "plate_category",
                        "Price": 6500 * i * priceMult
                    }
                );

                database.traders["5ac3b934156ae10c4430e83c"].assort.items.push(
                    {
                        "_id": fullArmorPlate._id,
                        "_tpl": fullArmorPlate._id,
                        "parentId": "hideout",
                        "slotId": "hideout",
                        "upd": {
                            "StackObjectsCount": 99999999,
                            "BuyRestrictionMax": 30 / i,
                            "UnlimitedCount": true
                        }
                    }
                );

                database.traders["5ac3b934156ae10c4430e83c"].assort.barter_scheme[fullArmorPlate._id] =
                    [
                        [{
                            _tpl: "5449016a4bdc2d6f028b456f",
                            count: 6500 * i * priceMult
                        }]
                    ]

                database.traders["5ac3b934156ae10c4430e83c"].assort.loyal_level_items[fullArmorPlate._id] = loyalLevel;

                if (i <= config.BotGenConfig.MaxScavPlateLevel) scavFullPlates.push(fullArmorPlate._id);
                FullPlates.push(fullArmorPlate._id);
                if (i >= 5) {
                    bossFullPlates.push(fullArmorPlate._id);
                }
            }
        }
    }

    public tweakCarriers(): void
    {
        Object.values(items).forEach(item => {
            // Headwear
            if (item._parent == "5a341c4086f77401f2541505" && item._props.armorClass > 0) {
                if (item._id == "59e7711e86f7746cae05fbe1") {
                    item._props.headSegments.push("Nape");
                    item._props.headSegments.push("Ears");
                }      
                item._props.Durability *= 0.6 * item._props.headSegments.length;
                item._props.MaxDurability = item._props.Durability;
                return;
            }

            // Visors
            if (item._parent == "5448e5724bdc2ddf718b4568" && item._props.armorClass == 0) {
                item._props.Durability = 15;
                item._props.armorClass = 1;
                if (item._id == "59e770b986f7742cbd762754" || item._id == "5b432be65acfc433000ed01f" || item._id == "0010321_GEARSET_ANTIFRAG") {
                    item._props.Durability = 30;
                    item._props.armorClass = 2;
                }
                item._props.MaxDurability = item._props.Durability;
                item._props.BluntThroughput = 0.35 * (1 - item._props.BlindnessProtection);
                item._props.RepairCost = 500 * (1 + item._props.BlindnessProtection / 2);
                item._props.ArmorMaterial = "Glass";
                item._props.armorZone = ["Head"];
                item._props.headSegments = ["Eyes"];
                item._props.RicochetParams = {
                    "x": 0.7,
                    "y": 0.3,
                    "z": 55
                }
                return;
            }


            if (item._parent == "5448e5284bdc2dcb718b4567" && item._props.armorClass > 0 || item._parent == "5448e54d4bdc2dcc718b4568" && item._props.armorClass > 0) {
                if (config.GenerationConfig.IgnoreIntegratedArmors && item._props.ArmorMaterial == "Aramid") {
                    item._props.Durability *= 2;
                    item._props.MaxDurability = item._props.Durability;
                    this.tweakPrice(item, 0.5);
                    return;
                }
                
                // Integrated Armor    
                // 6B2
                if (item._id == "5df8a2ca86f7740bfe6df777") {
                    item._props.Durability = 128;
                    item._props.MaxDurability = item._props.Durability;
                    this.tweakPrice(item, 0.5);
                    return;
                }

                // NPP KlASS Kora-Kulon
                if (item._id == "64be79c487d1510151095552" || item._id == "64be79e2bf8412471d0d9bcc") {
                    item._props.Durability = 128;
                    item._props.MaxDurability = item._props.Durability;
                    this.tweakPrice(item, 0.5);
                    return;
                }

                // MF-UNTAR
                if (item._id == "5ab8e4ed86f7742d8e50c7fa") {
                    item._props.Durability = 100;
                    item._props.MaxDurability = item._props.Durability;
                    this.tweakPrice(item, 0.5);
                    return;
                }

                // 6B5-16
                if (item._id == "5c0e3eb886f7742015526062") {
                    item._props.Durability = 160;
                    item._props.MaxDurability = item._props.Durability;
                    this.tweakPrice(item, 0.5);
                    return;
                }

                // 6B3TM-01
                if (item._id == "5d5d646386f7742797261fd9") {
                    item._props.Durability = 86;
                    item._props.MaxDurability = item._props.Durability;
                    this.tweakPrice(item, 0.5);
                    return;
                }

                // 6B5-15
                if (item._id == "5c0e446786f7742013381639") {
                    item._props.Durability = 110;
                    item._props.MaxDurability = item._props.Durability;
                    this.tweakPrice(item, 0.5);
                    return;
                }

                if (item._parent == "5448e54d4bdc2dcc718b4568" && item._props.armorClass > 0)
                    item._props.MergesWithChildren = true;

                let isSmallBoi = !(item._id == "0010321_GEARSET_QUICK000" || 
                                    item._id == "5c0e51be86f774598e797894" || item._id == "5c0e53c886f7747fa54205c7" || item._id == "5c0e541586f7747fa54205c9" ||
                                    item._id == "5c0e5bab86f77461f55ed1f3" || item._id == "5c0e57ba86f7747fa141986d" || item._id == "5f5f41476bdad616ad46d631");
                let hasArms = item._props.armorZone.includes("LeftArm");

                let armorClass = item._props.armorClass;
                let material = item._props.ArmorMaterial;

                item._props.ArmorMaterial = "Aramid";
                item._props.Slots = [];
                
                if (isSmallBoi) {
                    item._props.Slots.push({
                            "_name": "mod_equipment_plate",
                            "_id": `${item._id}_mainPlateSlot`,
                            "_parent": item._id,
                            "_props": {
                                "filters": [
                                    {
                                        "Filter": Plates
                                    }
                                ]
                            },
                            "_required": false,
                            "_mergeSlotWithChildren": true,
                            _proto: "55d30c4c4bdc2db4468b457e"
                    });
                }
                else {
                    item._props.Slots.push({
                            "_name": "mod_equipment_full",
                            "_id": `${item._id}_mainFullPlateSlot`,
                            "_parent": item._id,
                            "_props": {
                                "filters": [
                                    {
                                        "Filter": FullPlates
                                    }
                                ]
                            },
                            "_required": false,
                            "_mergeSlotWithChildren": true,
                            _proto: "55d30c4c4bdc2db4468b457e"
                    });
                }

                // 511 Hexgrid
                if (item._id == "5fd4c474dd870108a754b241") {
                    item._props.weaponErgonomicPenalty = -1;
                    item._props.speedPenaltyPercent = -1;
                    item._props.mousePenalty = -1;
                    item._props.armorClass = 1;
                    item._props.Durability = 10;
                    item._props.MaxDurability = item._props.Durability;  
                }

                // HPC
                else if (item._id == "63737f448b28897f2802b874") {
                    item._props.weaponErgonomicPenalty = 0;
                    item._props.speedPenaltyPercent = -1;
                    item._props.mousePenalty = 0;
                    item._props.armorClass = 1;
                    item._props.Durability = 10;
                    item._props.MaxDurability = item._props.Durability;
                }

                // TT SK
                else if (item._id == "628cd624459354321c4b7fa2") {
                    item._props.weaponErgonomicPenalty = 0;
                    item._props.speedPenaltyPercent = -1;
                    item._props.mousePenalty = 0;
                    item._props.armorClass = 1;
                    item._props.Durability = 10;
                    item._props.MaxDurability = item._props.Durability;
                }

                // S&S
                else if (item._id == "628b9784bcf6e2659e09b8a2" || item._id == "628b9c7d45122232a872358f") {
                    item._props.weaponErgonomicPenalty = -1;
                    item._props.speedPenaltyPercent = 0;
                    item._props.mousePenalty = 0;
                    item._props.armorClass = 1;
                    item._props.Durability = 10;
                    item._props.MaxDurability = item._props.Durability;
                }

                // MBSS
                else if (item._id == "64a5366719bab53bd203bf33") {
                    item._props.weaponErgonomicPenalty = -1;
                    item._props.speedPenaltyPercent = 0;
                    item._props.mousePenalty = -1;
                    item._props.armorClass = 1;
                    item._props.Durability = 10;
                    item._props.MaxDurability = item._props.Durability;
                }

                // LBT 6094A
                else if (item._id == "5e4abb5086f77406975c9342" || item._id == "6038b4b292ec1c3103795a0b" || item._id == "6038b4ca92ec1c3103795a0d" ||
                        item._id == "010521_ARMR_SLICK_FDE000" || item._id == "010521_ARMR_SLICK_ODG000") {
                    item._props.weaponErgonomicPenalty = 0;
                    item._props.speedPenaltyPercent = 0;
                    item._props.mousePenalty = 0;
                    item._props.armorClass = 3;
                    item._props.Durability = 100;
                    item._props.MaxDurability = item._props.Durability;
                }

                else {
                    if (item._props.ArmorType == "Heavy" || hasArms) {
                        item._props.armorClass = 3;
                        item._props.Durability *= 3;
                        item._props.MaxDurability = item._props.Durability;
                        item._props.BluntThroughput *= 0.85;               
                    }
                    else {
                        item._props.armorClass = 2;
                        item._props.Durability *= 2;
                        item._props.MaxDurability = item._props.Durability;
                        
                    }
                    
                    item._props.weaponErgonomicPenalty /= 2;
                    item._props.speedPenaltyPercent /= 2;
                    item._props.mousePenalty /= 2;
                }

                item._props.BluntThroughput *= 1.8;
                item._props.Weight *= weightRetainPer;

                // reduce repair cost
                item._props.RepairCost /= 10;

                this.tweakPrice(item, 0.1);

                Logger.info(`[WM-RPSR] Tweaked Armor[${item._id}]`);

                Object.values(database.bots.types).forEach(bot => {
                    let isScav = bot.appearance.body["5cc2e59214c02e000f16684e"] != null;

                    let isBoss = bot.firstName.length == 1; // boss have only 1 first name

                    bot.chances.mods.mod_equipment_plate = isBoss ? config.BotGenConfig.BossChestPlateChance : isScav ? config.BotGenConfig.ScavChestPlateChance : config.BotGenConfig.BaseChestPlateChance;
                    bot.chances.mods.mod_equipment_full = isBoss ? config.BotGenConfig.BossFullPlateChance : isScav ? config.BotGenConfig.ScavFullPlateChance : config.BotGenConfig.BaseFullPlateChance;

                    if (isBoss) {
                        if (isSmallBoi) bot.inventory.mods[item._id] = { "mod_equipment_plate": bossPlates };
                        else bot.inventory.mods[item._id] = { "mod_equipment_full": bossFullPlates };
                    }
                    else {
                        if (isSmallBoi) bot.inventory.mods[item._id] = { "mod_equipment_plate": isScav ? scavPlates : Plates };
                        else bot.inventory.mods[item._id] = { "mod_equipment_full": isScav ? scavFullPlates : FullPlates };
                    }
                });
            }
        });
    }

    public tweakAmmoDamage(): void
    {
        if (config.GenerationConfig.TweakAmmoDamage) {
            Object.values(items).forEach(item => {
                if (item._parent == "5485a8684bdc2da71d8b4567" && item._props.ArmorDamage != null) {
                    item._props.ArmorDamage *= 0.9;
                }
            })

            Logger.info(`[WM-RPSR] Tweaked Armor Damage`);
        }
        
    }

    private tweakPrice(item:ITemplateItem, percent:number): void
    {
        let price = database.templates.prices[item._id];
        price = Object.values(database.templates.handbook.Items).find(a => a.Id == item._id).Price;
        price = ((price * percent).toString().split(".")[0]) as unknown as number;

        Object.values(database.templates.handbook.Items).find(a => a.Id == item._id).Price = price;
        database.templates.prices[item._id] = price;

        for (let trader in database.traders) {
            if (database.traders[trader].assort == undefined)
                continue;

            let index = database.traders[trader].assort.items.findIndex(entry => entry._tpl == item._id);

            if (index != -1) {
                let id = database.traders[trader].assort.items[index]._id;
                database.traders[trader].assort.barter_scheme[id][0][0].count *= percent;
            }
        }
    }
}

interface IConfig {
    GenerationConfig: IGenerationConfig
    BotGenConfig: IBotGenerationConfig
    MaterialsConfig: IMaterialsConfig
}

interface IGenerationConfig {
    UserLocale: string
    IgnoreIntegratedArmors: boolean
    ChangeMaterialDestructibility: boolean
    TweakBackgroundColor: boolean
    TweakAmmoDamage: boolean
}

interface IBotGenerationConfig {
    MaxScavPlateLevel: number
    BaseChestPlateChance: number
    BaseFullPlateChance: number
    BossChestPlateChance: number
    BossFullPlateChance: number
    ScavChestPlateChance: number
    ScavFullPlateChance: number
}

interface IMaterialsConfig {
    UHMWPE: IMaterialConfig
    Aramid: IMaterialConfig
    Ceramic: IMaterialConfig
    Titan: IMaterialConfig
    Aluminium: IMaterialConfig
    Combined: IMaterialConfig
    ArmoredSteel: IMaterialConfig
    Glass: IMaterialConfig
}

interface IMaterialConfig {
    DurabilityBase: number
    WeightMultiplier: number
    PenaltyMultiplier: number
    BluntThroughput: number
    PriceMultiplier: number
    Destructibility: number
    ExplosionDestructibility: number
}

module.exports = { mod: new plates() };