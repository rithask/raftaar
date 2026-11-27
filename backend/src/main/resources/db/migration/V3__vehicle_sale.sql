-- When and for how much a vehicle was sold, for its total cost of owning it. Only adds empty columns.
alter table vehicle
    add column sold_on       date,
    add column sale_price    numeric(12, 2),
    add column sale_odometer numeric(10, 1);
