// Mapping of LPQ locations to their IDs
const LPQ_LOCATION_IDS = {
    'Le Pain Quotidien Nieuw Loopveld 2 & 4 Amstelveen': 471,
    'Le Pain Quotidien Beethovenstraat 56 hs Amsterdam': 475,
    'Le Pain Quotidien Van Leijenberghlaan 130 Amsterdam': 472,
    'Le Pain Quotidien Johannes Verhulststraat 104 Amsterdam': 476,
    'Le Pain Quotidien Spuistraat 266 hs Amsterdam': 477,
    'Le Pain Quotidien Dumortierlaan 75 Knokke': 795,
    'Le Pain Quotidien Leopoldlaan Zaventem': 792,
    'Le Pain Quotidien Chaussée de Boondael 479 Brussels': 799
};

// Mapping of source names to their IDs
const SOURCE_IDS = {
    'Google Reviews': 69,
    'TripAdvisor': 30,
    'Facebook': 32,
    'Yelp': 57,
    'Happy Cow': 71,
    'Foursquare': 70,
    'Yelp': 74
};

// Company ID for Le Pain Quotidien
const COMPANY_ID = 'lpq_benelux';

// Generate arrays from the mappings
const LPQ_LOCATIONS = [
    'Le Pain Quotidien Nieuw Loopveld 2 & 4 Amstelveen',
    'Le Pain Quotidien Beethovenstraat 56 hs Amsterdam',
    'Le Pain Quotidien Van Leijenberghlaan 130 Amsterdam',
    'Le Pain Quotidien Johannes Verhulststraat 104 Amsterdam',
    'Le Pain Quotidien Spuistraat 266 hs Amsterdam',
    'Le Pain Quotidien Dumortierlaan 75 Knokke',
    'Le Pain Quotidien Leopoldlaan Zaventem',
    'Le Pain Quotidien Chaussée de Boondael 479 Brussels'
];

const SOURCES = [
    'Google Reviews',
    'TripAdvisor',
    'Facebook',
    'Yelp'
];

module.exports = {
    LPQ_LOCATION_IDS,
    LPQ_LOCATIONS,
    SOURCE_IDS,
    SOURCES,
    COMPANY_ID
};
