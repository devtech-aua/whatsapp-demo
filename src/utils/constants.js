// Mapping of LPQ locations to their IDs
const LPQ_LOCATION_IDS = {
    'Le Pain Quotidien Nieuw Loopveld 2 & 4 Amstelveen': 471,
    'Le Pain Quotidien Beethovenstraat 56 hs Amsterdam': 472,
    'Le Pain Quotidien Van Leijenberghlaan 130 Amsterdam': 475,
    'Le Pain Quotidien Johannes Verhulststraat 104 Amsterdam': 476,
    'Le Pain Quotidien Spuistraat 266 hs Amsterdam': 477,
    'Le Pain Quotidien Dumortierlaan 75 Knokke': 819,
    'Le Pain Quotidien Leopoldlaan Zaventem': 820,
    'Le Pain Quotidien Chaussée de Boondael 479 Brussels': 821
};

// Mapping of source names to their IDs
const SOURCE_IDS = {
    'Google': 69,
    'Facebook': 70,
    'Happy Cow': 71,
    'Foursquare': 72,
    'TripAdvisor': 73,
    'Yelp': 74
};

// Company ID for Le Pain Quotidien
const COMPANY_ID = 175;

// Generate arrays from the mappings
const LPQ_LOCATIONS = Object.keys(LPQ_LOCATION_IDS);
const SOURCES = Object.keys(SOURCE_IDS);

module.exports = {
    LPQ_LOCATION_IDS,
    SOURCE_IDS,
    COMPANY_ID,
    LPQ_LOCATIONS,
    SOURCES
};
