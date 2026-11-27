package com.raftaar.search;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SearchTest {
    @Test
    void wordsAreMatchedAnywhereIgnoringCase() {
        assertEquals("%chain lube%", Search.likePattern("Chain Lube"));
    }

    @Test
    void likesWildcardsAreTakenLiterally() {
        assertEquals("%50\\% off%", Search.likePattern("50% off"));
        assertEquals("%a\\_b%", Search.likePattern("a_b"));
        assertEquals("%c:\\\\x%", Search.likePattern("C:\\x"));
    }
}
