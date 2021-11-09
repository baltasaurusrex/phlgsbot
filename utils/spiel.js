import pkg from "viber-bot";
const { Message } = pkg;

const instructions = {
  fetchPriceInfo: `To *fetch price updates* on a specific ISIN, please type it's series
  
E.g. '577'
  
You may also type multiple series with one query
  
E.g. '577 1061 765'`,

  timeAndSales: `For *time and sales* data, please type '{series} time and sales MM/DD'
  
Note: If MM/DD is not specified, the date is assumed to be the current date`,

  historicalPrices: `For *historical prices*, please type "{series} {period}"
  
with the choices for *period* being:
  - 'weekly' (past 7 trading days)
  - '2 weeks' (past 14 trading days)
  - 'last week' (past 7 trading days from last Fri)
  - 'last 2 weeks' (past 14 trading days from last Fri)
  
Note: If MM/DD is not specified, the date is assumed to be the current date`,
};

export const dealerSpiel = [
  new Message.Text(instructions.fetchPriceInfo),
  new Message.Text(instructions.timeAndSales),
  new Message.Text(instructions.historicalPrices),
];

export const brokerSpiel = [
  new Message.Text(
    `To input a price update on a specific ISIN, please type it's series, followed by it's bid, offer, bid vol, and offer vol`
  ),
  new Message.Text(`E.g. 577 3800 3750 50 50`),
  new Message.Text(
    `Note: for ease of input, the series is just the shortest way you can identify it`
  ),
  new Message.Text(`E.g. 5-77 -> 577`),
  new Message.Text(`E.g. R513 -> 513`),
  new Message.Text(`E.g. 10-61 -> 1061`),
  new Message.Text(`If one data point is missing, fill it with "na"`),
  new Message.Text(`Ex: If 5-77 has no bids, then type `),
  new Message.Text(`577 na 3750 na 50`),
];

export const adminSpiel = [
  new Message.Text(
    `Since you're an *admin*, you can perform both dealer (reading pricing data) and broker functions (create pricing data)`
  ),
  new Message.Text(`*===DEALER FUNCTIONS===*`),
  new Message.Text(instructions.fetchPriceInfo),
  new Message.Text(instructions.timeAndSales),
  new Message.Text(instructions.historicalPrices),
  new Message.Text(`*===BROKER FUNCTIONS===*`),
  new Message.Text(
    `To *input a price update* on a specific ISIN, please type it's series, followed by it's bid, offer, bid vol (optional), offer vol (optional), and broker \n\nE.g. 577 2900 2750 100 100 p`
  ),
  new Message.Text(
    `Note 1: As a shortcut, if volume isn't specified, but a corresponding bid or offer is, then the volume for that bid or offer is understood to be 50 Mn\n\nE.g: 577 2900 2750 p === 577 2900 2750 50 50 p`
  ),
  new Message.Text(
    `Note 2: For ease of input, the *series* is just the *shortest way you can identify it* \n\nE.g: \n5-77 -> 577 \nR513 -> 513 \n10-61 -> 1061`
  ),
  new Message.Text(
    `Note 3: The *first digit* from the left is understood as the *big fig* \n\nI.e. 3800 -> 3.800`
  ),
  new Message.Text(
    `Note 4: If either *the bid or the offer is missing*, fill it with *"na"* \n\nE.g. If 5-77 has no bids, then type: \n\n577 na 2750 p\n\nNote that the volume here is assumed to be 50 (see Note 1)`
  ),
  new Message.Text(
    `Note 5: broker shorts \n\np = Prebon, a = Amstel, t = Tradition, g = GFI`
  ),
];
