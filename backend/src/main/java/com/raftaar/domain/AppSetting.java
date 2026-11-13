package com.raftaar.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "app_setting")
public class AppSetting {
    @Id public String key;
    public String value;
}
