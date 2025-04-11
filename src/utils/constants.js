// Mapping of LPQ locations to their IDs
const LPQ_LOCATION_IDS = {
    'Le Pain Quotidien Nieuw Loopveld 2 & 4 Amstelveen': 'lpq_amstelveen_1',
    'Le Pain Quotidien Beethovenstraat 56 hs Amsterdam': 'lpq_amsterdam_1',
    'Le Pain Quotidien Van Leijenberghlaan 130 Amsterdam': 'lpq_amsterdam_2',
    'Le Pain Quotidien Johannes Verhulststraat 104 Amsterdam': 'lpq_amsterdam_3',
    'Le Pain Quotidien Spuistraat 266 hs Amsterdam': 'lpq_amsterdam_4',
    'Le Pain Quotidien Dumortierlaan 75 Knokke': 'lpq_knokke_1',
    'Le Pain Quotidien Leopoldlaan Zaventem': 'lpq_zaventem_1',
    'Le Pain Quotidien Chaussée de Boondael 479 Brussels': 'lpq_brussels_1'
};

// Mapping of source names to their IDs
const SOURCE_IDS = {
    'Google Reviews': 'google',
    'TripAdvisor': 'tripadvisor',
    'Facebook': 'facebook',
    'Yelp': 'yelp',
    'Happy Cow': 71,
    'Foursquare': 72,
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
