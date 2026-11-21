package com.raftaar.upkeep;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ServiceController {
    private final ServiceRecords serviceRecords;

    public ServiceController(ServiceRecords serviceRecords) {
        this.serviceRecords = serviceRecords;
    }

    @GetMapping("/vehicles/{vehicleId}/services")
    public List<ServiceRecords.ServiceRow> list(@PathVariable Long vehicleId) {
        return serviceRecords.list(vehicleId);
    }

    @PostMapping("/vehicles/{vehicleId}/services")
    public ServiceRecords.ServiceRow add(@PathVariable Long vehicleId, @RequestBody ServiceRecords.Input input) {
        return serviceRecords.add(vehicleId, input);
    }

    @PutMapping("/services/{id}")
    public ServiceRecords.ServiceRow update(@PathVariable Long id, @RequestBody ServiceRecords.Input input) {
        return serviceRecords.update(id, input);
    }

    @DeleteMapping("/services/{id}")
    public void delete(@PathVariable Long id) {
        serviceRecords.delete(id);
    }
}
