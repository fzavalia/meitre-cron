export type Restaurant = {
  id: string;
  name: string;
  url: string;
};

export type AvailableDate = {
  date: Date;
  hours: string[];
};

export type AvailableRestaurant = {
  restaurant: Restaurant;
  dates: AvailableDate[];
};

export type Slot = {
  type: string,
  hour: string
}