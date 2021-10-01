export const formatPrice = (price) => {
  console.log("price: ", price);
  const regex = new RegExp(`na|\\/`, "i");
  if (regex.test(price)) return null;
  const decimal = price.slice(0, 1) + "." + price.slice(1);

  const float = Number.parseFloat(decimal);

  const precise = Number.parseFloat(float.toPrecision(4));

  return precise;
};

export const getBroker = (code) => {
  switch (code.toLowerCase()) {
    case "p":
      return "Prebon";
    case "a":
      return "Amstel";
    case "t":
      return "Tradition";
    case "g":
      return "GFI";
    default:
      return "error";
  }
};
