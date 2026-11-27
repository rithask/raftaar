package com.raftaar.data;

import com.raftaar.expense.Expense;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.*;

/** Reading files from other apps. Fuelio's and Drivvo's are made by hand from their documented layouts. */
class ImportFormatsTest {
    static BigDecimal d(String s) { return new BigDecimal(s); }

    static Imported read(String name, String text) throws Exception {
        return ImportFormats.read(name, text.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void raftaarsOwnExport() throws Exception {
        var file = read("raftaar-fuel.csv", "﻿vehicle,filled_at,odometer,volume,unit,price_per_unit,total_cost,full_tank,missed_previous,"
                + "station,brand,district,region,latitude,longitude,source,notes\r\n"
                + "Activa,2026-11-21T14:14:30+05:30,12000,5,L,101,505,true,false,\"HP, Edappally\",HP,Ernakulam,Kerala,,,MANUAL,\r\n");
        assertEquals(ImportSource.RAFTAAR, file.source);
        var fill = file.fills.getFirst();
        assertEquals("Activa", fill.vehicle());
        assertEquals("HP, Edappally", fill.record().stationName);
        assertEquals(d("505"), fill.record().totalCost);
        assertTrue(fill.record().fullTank);
    }

    static final String FUELIO = """
            "## Vehicle"
            "Name","Description","DistUnit","FuelUnit","ConsumptionUnit","ImportCSVDateFormat","VIN","Insurance","Plate","Make","Model","Year","TankCount","Tank1Type","Tank2Type","Active","Tank1Capacity"
            "Pulsar","Daily","0","0","0","yyyy-MM-dd","","","KL07AB1234","Bajaj","Pulsar 150","2019","1","100","0","1","15"
            "## Log"
            "Data","Odo (km)","Fuel (litres)","Full","Price (optional)","l/100km (optional)","latitude (optional)","longitude (optional)","City (optional)","Notes (optional)","Missed","TankNumber","FuelType","VolumePrice","StationID (optional)","ExcludeDistance","UniqueId","TankCalc","Weather"
            "2026-01-05 10:22","12345","5.20","1","540.00","","9.98","76.28","Kochi","","0","1","110","103.85","0","0","1736052720000","0",""
            "2026-01-20 18:05","12610","2.00","0","210.00","","0","0","","half tank","1","1","110","105.00","0","0","1737376500000","0",""
            "## CostCategories"
            "CostTypeID","Name","priority","color"
            "1","Service","0","#ff0000"
            "2","Insurance","0","#00ff00"
            "3","Parking","0","#0000ff"
            "## Costs"
            "CostTitle","Date","Odo","CostTypeID","Notes","Cost","flag","idR","read","RemindOdo","RemindDate","isTemplate","RepeatOdo","RepeatMonths","isIncome","UniqueId"
            "Oil change","2026-02-01","13000","1","Motul","850.00","0","0","1","0","","0","0","0","0","1"
            "Yearly cover","2026-03-01","13400","2","","1450.00","0","0","1","0","","0","0","0","0","2"
            "Mall","2026-03-02","","3","","40.00","0","0","1","0","","0","0","0","0","3"
            "Refund","2026-03-05","","2","","200.00","0","0","1","0","","0","0","0","1","4"
            """;

    @Test
    void fuelioBackup() throws Exception {
        var file = read("Fuelio-backup.csv", FUELIO);
        assertEquals(ImportSource.FUELIO, file.source);
        assertEquals("KL07AB1234", file.vehicles.get("Pulsar").registration());
        assertEquals(2, file.fills.size());
        var first = file.fills.get(0).record();
        assertEquals(d("540.00"), first.totalCost, "Fuelio's Price is what was paid in all");
        assertEquals(d("5.20"), first.volume);
        assertEquals("Kochi", first.district);
        var second = file.fills.get(1).record();
        assertFalse(second.fullTank);
        assertTrue(second.missedPrevious);
        assertNull(second.latitude, "0,0 is no place");
        assertEquals(1, file.services.size(), "the Service category's cost is a service");
        assertEquals("Oil change", file.services.getFirst().record().title);
        assertEquals(2, file.expenses.size(), "income is left out");
        assertEquals(Expense.Category.INSURANCE, file.expenses.get(0).record().category);
        assertEquals(Expense.Category.PARKING, file.expenses.get(1).record().category);
    }

    @Test
    void fuelioInMilesAndGallons() throws Exception {
        var file = read("f.csv", FUELIO.replace("\"Pulsar\",\"Daily\",\"0\",\"0\"", "\"Pulsar\",\"Daily\",\"1\",\"1\""));
        var first = file.fills.getFirst().record();
        assertEquals(d("19867.4"), first.odometer, "12,345 miles");
        assertEquals(0, d("19.684").compareTo(first.volume.setScale(3, java.math.RoundingMode.HALF_UP)), "5.2 US gallons in litres");
    }

    @Test
    void drivvoLikeSections() throws Exception {
        var file = read("drivvo-export.csv", """
                #Refuelling
                Date,Odometer,Fuel,Price/L,Total cost,Liters,Full tank?,Gas station,Notes
                21/11/2026 08:30,12000,Petrol,"102,50","512,50",5,Yes,Shell Edappally,
                #Service
                Date,Odometer,Type of service,Total cost,Place,Notes
                01/12/2026,12500,Chain set,1800,Bajaj service,
                #Expense
                Date,Odometer,Type of expense,Total cost,Notes
                03/12/2026,12550,Parking,30,
                """);
        assertEquals(ImportSource.OTHER, file.source);
        var fill = file.fills.getFirst();
        assertEquals("drivvo export", fill.vehicle(), "no vehicle column: named after the file");
        assertEquals(d("102.50"), fill.record().pricePerUnit);
        assertEquals(d("512.50"), fill.record().totalCost);
        assertEquals(LocalDate.of(2026, 11, 21), fill.record().filledAt.atZone(ZoneId.systemDefault()).toLocalDate(), "day first");
        assertEquals("Chain set", file.services.getFirst().record().title);
        assertEquals("Bajaj service", file.services.getFirst().record().workshop);
        assertEquals(Expense.Category.PARKING, file.expenses.getFirst().record().category);
    }

    @Test
    void portugueseHeadingsByTheirColumns() throws Exception {
        var file = read("abastecimentos.csv", """
                Data,Odômetro,Litros,Preço/L,Valor total,Tanque cheio,Posto,Veículo
                21/11/2026,12000,"5,0","102,50","512,50",Sim,Shell,Moto
                """);
        var fill = file.fills.getFirst();
        assertEquals("Moto", fill.vehicle());
        assertEquals(d("5.0"), fill.record().volume);
        assertTrue(fill.record().fullTank);
    }

    @Test
    void rowsThatCantBeReadAreSaidSo() throws Exception {
        var file = read("x.csv", """
                Date,Odometer,Liters,Total cost
                21/11/2026,,5,500
                22/11/2026,12100,5,510
                """);
        assertEquals(1, file.fills.size());
        assertEquals("Row 2: no odometer reading", file.skipped.getFirst());
    }

    @Test
    void numbersAsAppsWriteThem() {
        assertEquals(d("1234.50"), Cells.parseNumber("₹1,234.50"));
        assertEquals(d("1234.50"), Cells.parseNumber("1.234,50"));
        assertEquals(d("102.5"), Cells.parseNumber("102,5"));
        assertEquals(d("1234"), Cells.parseNumber("1,234"));
        assertNull(Cells.parseNumber("-"));
        assertNull(Cells.parseNumber(""));
    }

    @Test
    void columnNamesAreComparedLoosely() {
        assertEquals("odo", Cells.key("Odo (km)"));
        assertEquals("odometro", Cells.key("Odômetro"));
        assertEquals("price per unit", Cells.key("price_per_unit"));
    }
}
