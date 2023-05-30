;; problem file: problem-BFS-1.pddl
(define (problem default)
    (:domain default)
    (:objects c_0_0 c_0_1 c_0_2 c_0_3 c_0_4 c_0_5 c_0_6 c_0_7 c_0_8 c_0_9 c_0_10 c_0_11 c_0_12 c_0_13 c_0_14 c_0_15 c_0_16 c_0_17 c_0_18 c_1_9 c_2_0 c_2_1 c_2_2 c_2_3 c_2_4 c_2_5 c_2_6 c_2_7 c_2_8 c_2_9 c_2_10 c_2_11 c_2_12 c_2_13 c_2_14 c_2_15 c_2_16 c_2_17 c_2_18 c_3_9 c_4_0 c_4_1 c_4_2 c_4_3 c_4_4 c_4_5 c_4_6 c_4_7 c_4_8 c_4_9 c_4_10 c_4_11 c_4_12 c_4_13 c_4_14 c_4_15 c_4_16 c_4_17 c_4_18 c_5_9 c_6_0 c_6_1 c_6_2 c_6_3 c_6_4 c_6_5 c_6_6 c_6_7 c_6_8 c_6_9 c_6_10 c_6_11 c_6_12 c_6_13 c_6_14 c_6_15 c_6_16 c_6_17 c_6_18 c_7_9 c_8_0 c_8_1 c_8_2 c_8_3 c_8_4 c_8_5 c_8_6 c_8_7 c_8_8 c_8_9 c_8_10 c_8_11 c_8_12 c_8_13 c_8_14 c_8_15 c_8_16 c_8_17 c_8_18 c_11_0 c_11_1 c_11_2 c_11_3 c_11_4 c_11_5 c_11_6 c_11_7 c_11_8 c_11_9 c_11_10 c_11_11 c_11_12 c_11_13 c_11_14 c_11_15 c_11_16 c_11_17 c_11_18 c_12_9 c_13_0 c_13_1 c_13_3 c_13_4 c_13_5 c_13_6 c_13_7 c_13_8 c_13_9 c_13_10 c_13_11 c_13_12 c_13_13 c_13_14 c_13_15 c_13_16 c_13_17 c_13_18 c_14_9 c_15_0 c_15_1 c_15_2 c_15_3 c_15_4 c_15_5 c_15_6 c_15_7 c_15_8 c_15_9 c_15_10 c_15_11 c_15_12 c_15_13 c_15_14 c_15_15 c_15_16 c_15_17 c_15_18 c_16_9 c_17_0 c_17_1 c_17_2 c_17_3 c_17_4 c_17_5 c_17_6 c_17_7 c_17_8 c_17_9 c_17_10 c_17_11 c_17_12 c_17_13 c_17_14 c_17_15 c_17_16 c_17_17 c_17_18 c_18_9 c_19_0 c_19_1 c_19_2 c_19_3 c_19_4 c_19_5 c_19_6 c_19_7 c_19_8 c_19_9 c_19_10 c_19_11 c_19_12 c_19_13 c_19_14 c_19_15 c_19_16 c_19_17 c_19_18)
    (:init (cell c_0_0) (cell c_0_1) (cell c_0_2) (cell c_0_3) (cell c_0_4) (cell c_0_5) (cell c_0_6) (cell c_0_7) (cell c_0_8) (cell c_0_9) (not (cell c_0_10)) (cell c_0_11) (cell c_0_12) (cell c_0_13) (cell c_0_14) (cell c_0_15) (cell c_0_16) (cell c_0_17) (cell c_0_18) (cell c_1_9) (cell c_2_0) (cell c_2_1) (cell c_2_2) (cell c_2_3) (cell c_2_4) (cell c_2_5) (cell c_2_6) (cell c_2_7) (cell c_2_8) (cell c_2_9) (cell c_2_10) (cell c_2_11) (cell c_2_12) (cell c_2_13) (cell c_2_14) (cell c_2_15) (cell c_2_16) (cell c_2_17) (cell c_2_18) (cell c_3_9) (cell c_4_0) (cell c_4_1) (cell c_4_2) (cell c_4_3) (cell c_4_4) (cell c_4_5) (cell c_4_6) (cell c_4_7) (cell c_4_8) (cell c_4_9) (cell c_4_10) (cell c_4_11) (cell c_4_12) (cell c_4_13) (cell c_4_14) (cell c_4_15) (cell c_4_16) (cell c_4_17) (cell c_4_18) (cell c_5_9) (cell c_6_0) (cell c_6_1) (cell c_6_2) (cell c_6_3) (cell c_6_4) (cell c_6_5) (cell c_6_6) (cell c_6_7) (cell c_6_8) (cell c_6_9) (cell c_6_10) (cell c_6_11) (cell c_6_12) (cell c_6_13) (cell c_6_14) (cell c_6_15) (cell c_6_16) (cell c_6_17) (cell c_6_18) (cell c_7_9) (cell c_8_0) (cell c_8_1) (cell c_8_2) (cell c_8_3) (cell c_8_4) (cell c_8_5) (cell c_8_6) (cell c_8_7) (cell c_8_8) (cell c_8_9) (cell c_8_10) (cell c_8_11) (cell c_8_12) (cell c_8_13) (cell c_8_14) (cell c_8_15) (cell c_8_16) (cell c_8_17) (cell c_8_18) (cell c_11_0) (cell c_11_1) (cell c_11_2) (cell c_11_3) (cell c_11_4) (cell c_11_5) (cell c_11_6) (cell c_11_7) (cell c_11_8) (cell c_11_9) (cell c_11_10) (cell c_11_11) (cell c_11_12) (cell c_11_13) (cell c_11_14) (cell c_11_15) (cell c_11_16) (cell c_11_17) (cell c_11_18) (cell c_12_9) (cell c_13_0) (cell c_13_1) (cell c_13_3) (cell c_13_4) (cell c_13_5) (cell c_13_6) (cell c_13_7) (cell c_13_8) (cell c_13_9) (cell c_13_10) (cell c_13_11) (cell c_13_12) (cell c_13_13) (cell c_13_14) (cell c_13_15) (cell c_13_16) (cell c_13_17) (cell c_13_18) (cell c_14_9) (cell c_15_0) (cell c_15_1) (cell c_15_2) (cell c_15_3) (cell c_15_4) (cell c_15_5) (cell c_15_6) (cell c_15_7) (cell c_15_8) (cell c_15_9) (cell c_15_10) (cell c_15_11) (cell c_15_12) (cell c_15_13) (cell c_15_14) (cell c_15_15) (cell c_15_16) (cell c_15_17) (cell c_15_18) (cell c_16_9) (cell c_17_0) (cell c_17_1) (cell c_17_2) (cell c_17_3) (cell c_17_4) (cell c_17_5) (cell c_17_6) (cell c_17_7) (cell c_17_8) (cell c_17_9) (cell c_17_10) (cell c_17_11) (cell c_17_12) (cell c_17_13) (cell c_17_14) (cell c_17_15) (cell c_17_16) (cell c_17_17) (cell c_17_18) (cell c_18_9) (cell c_19_0) (cell c_19_1) (cell c_19_2) (cell c_19_3) (cell c_19_4) (cell c_19_5) (cell c_19_6) (cell c_19_7) (cell c_19_8) (cell c_19_9) (cell c_19_10) (cell c_19_11) (cell c_19_12) (cell c_19_13) (cell c_19_14) (cell c_19_15) (cell c_19_16) (cell c_19_17) (cell c_19_18) (near c_0_0 c_0_1) (near c_0_1 c_0_0) (near c_0_1 c_0_2) (near c_0_2 c_0_1) (near c_0_2 c_0_3) (near c_0_3 c_0_2) (near c_0_3 c_0_4) (near c_0_4 c_0_3) (near c_0_4 c_0_5) (near c_0_5 c_0_4) (near c_0_5 c_0_6) (near c_0_6 c_0_5) (near c_0_6 c_0_7) (near c_0_7 c_0_6) (near c_0_7 c_0_8) (near c_0_8 c_0_7) (near c_0_8 c_0_9) (near c_0_9 c_0_8) (near c_0_9 c_1_9) (near c_0_9 c_0_10) (near c_0_10 c_0_9) (near c_0_10 c_0_11) (near c_0_11 c_0_10) (near c_0_11 c_0_12) (near c_0_12 c_0_11) (near c_0_12 c_0_13) (near c_0_13 c_0_12) (near c_0_13 c_0_14) (near c_0_14 c_0_13) (near c_0_14 c_0_15) (near c_0_15 c_0_14) (near c_0_15 c_0_16) (near c_0_16 c_0_15) (near c_0_16 c_0_17) (near c_0_17 c_0_16) (near c_0_17 c_0_18) (near c_0_18 c_0_17) (near c_1_9 c_0_9) (near c_1_9 c_2_9) (near c_2_0 c_2_1) (near c_2_1 c_2_0) (near c_2_1 c_2_2) (near c_2_2 c_2_1) (near c_2_2 c_2_3) (near c_2_3 c_2_2) (near c_2_3 c_2_4) (near c_2_4 c_2_3) (near c_2_4 c_2_5) (near c_2_5 c_2_4) (near c_2_5 c_2_6) (near c_2_6 c_2_5) (near c_2_6 c_2_7) (near c_2_7 c_2_6) (near c_2_7 c_2_8) (near c_2_8 c_2_7) (near c_2_8 c_2_9) (near c_2_9 c_1_9) (near c_2_9 c_2_8) (near c_2_9 c_3_9) (near c_2_9 c_2_10) (near c_2_10 c_2_9) (near c_2_10 c_2_11) (near c_2_11 c_2_10) (near c_2_11 c_2_12) (near c_2_12 c_2_11) (near c_2_12 c_2_13) (near c_2_13 c_2_12) (near c_2_13 c_2_14) (near c_2_14 c_2_13) (near c_2_14 c_2_15) (near c_2_15 c_2_14) (near c_2_15 c_2_16) (near c_2_16 c_2_15) (near c_2_16 c_2_17) (near c_2_17 c_2_16) (near c_2_17 c_2_18) (near c_2_18 c_2_17) (near c_3_9 c_2_9) (near c_3_9 c_4_9) (near c_4_0 c_4_1) (near c_4_1 c_4_0) (near c_4_1 c_4_2) (near c_4_2 c_4_1) (near c_4_2 c_4_3) (near c_4_3 c_4_2) (near c_4_3 c_4_4) (near c_4_4 c_4_3) (near c_4_4 c_4_5) (near c_4_5 c_4_4) (near c_4_5 c_4_6) (near c_4_6 c_4_5) (near c_4_6 c_4_7) (near c_4_7 c_4_6) (near c_4_7 c_4_8) (near c_4_8 c_4_7) (near c_4_8 c_4_9) (near c_4_9 c_3_9) (near c_4_9 c_4_8) (near c_4_9 c_5_9) (near c_4_9 c_4_10) (near c_4_10 c_4_9) (near c_4_10 c_4_11) (near c_4_11 c_4_10) (near c_4_11 c_4_12) (near c_4_12 c_4_11) (near c_4_12 c_4_13) (near c_4_13 c_4_12) (near c_4_13 c_4_14) (near c_4_14 c_4_13) (near c_4_14 c_4_15) (near c_4_15 c_4_14) (near c_4_15 c_4_16) (near c_4_16 c_4_15) (near c_4_16 c_4_17) (near c_4_17 c_4_16) (near c_4_17 c_4_18) (near c_4_18 c_4_17) (near c_5_9 c_4_9) (near c_5_9 c_6_9) (near c_6_0 c_6_1) (near c_6_1 c_6_0) (near c_6_1 c_6_2) (near c_6_2 c_6_1) (near c_6_2 c_6_3) (near c_6_3 c_6_2) (near c_6_3 c_6_4) (near c_6_4 c_6_3) (near c_6_4 c_6_5) (near c_6_5 c_6_4) (near c_6_5 c_6_6) (near c_6_6 c_6_5) (near c_6_6 c_6_7) (near c_6_7 c_6_6) (near c_6_7 c_6_8) (near c_6_8 c_6_7) (near c_6_8 c_6_9) (near c_6_9 c_5_9) (near c_6_9 c_6_8) (near c_6_9 c_7_9) (near c_6_9 c_6_10) (near c_6_10 c_6_9) (near c_6_10 c_6_11) (near c_6_11 c_6_10) (near c_6_11 c_6_12) (near c_6_12 c_6_11) (near c_6_12 c_6_13) (near c_6_13 c_6_12) (near c_6_13 c_6_14) (near c_6_14 c_6_13) (near c_6_14 c_6_15) (near c_6_15 c_6_14) (near c_6_15 c_6_16) (near c_6_16 c_6_15) (near c_6_16 c_6_17) (near c_6_17 c_6_16) (near c_6_17 c_6_18) (near c_6_18 c_6_17) (near c_7_9 c_6_9) (near c_7_9 c_8_9) (near c_8_0 c_8_1) (near c_8_1 c_8_0) (near c_8_1 c_8_2) (near c_8_2 c_8_1) (near c_8_2 c_8_3) (near c_8_3 c_8_2) (near c_8_3 c_8_4) (near c_8_4 c_8_3) (near c_8_4 c_8_5) (near c_8_5 c_8_4) (near c_8_5 c_8_6) (near c_8_6 c_8_5) (near c_8_6 c_8_7) (near c_8_7 c_8_6) (near c_8_7 c_8_8) (near c_8_8 c_8_7) (near c_8_8 c_8_9) (near c_8_9 c_7_9) (near c_8_9 c_8_8) (near c_8_9 c_8_10) (near c_8_10 c_8_9) (near c_8_10 c_8_11) (near c_8_11 c_8_10) (near c_8_11 c_8_12) (near c_8_12 c_8_11) (near c_8_12 c_8_13) (near c_8_13 c_8_12) (near c_8_13 c_8_14) (near c_8_14 c_8_13) (near c_8_14 c_8_15) (near c_8_15 c_8_14) (near c_8_15 c_8_16) (near c_8_16 c_8_15) (near c_8_16 c_8_17) (near c_8_17 c_8_16) (near c_8_17 c_8_18) (near c_8_18 c_8_17) (near c_11_0 c_11_1) (near c_11_1 c_11_0) (near c_11_1 c_11_2) (near c_11_2 c_11_1) (near c_11_2 c_11_3) (near c_11_3 c_11_2) (near c_11_3 c_11_4) (near c_11_4 c_11_3) (near c_11_4 c_11_5) (near c_11_5 c_11_4) (near c_11_5 c_11_6) (near c_11_6 c_11_5) (near c_11_6 c_11_7) (near c_11_7 c_11_6) (near c_11_7 c_11_8) (near c_11_8 c_11_7) (near c_11_8 c_11_9) (near c_11_9 c_11_8) (near c_11_9 c_12_9) (near c_11_9 c_11_10) (near c_11_10 c_11_9) (near c_11_10 c_11_11) (near c_11_11 c_11_10) (near c_11_11 c_11_12) (near c_11_12 c_11_11) (near c_11_12 c_11_13) (near c_11_13 c_11_12) (near c_11_13 c_11_14) (near c_11_14 c_11_13) (near c_11_14 c_11_15) (near c_11_15 c_11_14) (near c_11_15 c_11_16) (near c_11_16 c_11_15) (near c_11_16 c_11_17) (near c_11_17 c_11_16) (near c_11_17 c_11_18) (near c_11_18 c_11_17) (near c_12_9 c_11_9) (near c_12_9 c_13_9) (near c_13_0 c_13_1) (near c_13_1 c_13_0) (near c_13_3 c_13_4) (near c_13_4 c_13_3) (near c_13_4 c_13_5) (near c_13_5 c_13_4) (near c_13_5 c_13_6) (near c_13_6 c_13_5) (near c_13_6 c_13_7) (near c_13_7 c_13_6) (near c_13_7 c_13_8) (near c_13_8 c_13_7) (near c_13_8 c_13_9) (near c_13_9 c_12_9) (near c_13_9 c_13_8) (near c_13_9 c_14_9) (near c_13_9 c_13_10) (near c_13_10 c_13_9) (near c_13_10 c_13_11) (near c_13_11 c_13_10) (near c_13_11 c_13_12) (near c_13_12 c_13_11) (near c_13_12 c_13_13) (near c_13_13 c_13_12) (near c_13_13 c_13_14) (near c_13_14 c_13_13) (near c_13_14 c_13_15) (near c_13_15 c_13_14) (near c_13_15 c_13_16) (near c_13_16 c_13_15) (near c_13_16 c_13_17) (near c_13_17 c_13_16) (near c_13_17 c_13_18) (near c_13_18 c_13_17) (near c_14_9 c_13_9) (near c_14_9 c_15_9) (near c_15_0 c_15_1) (near c_15_1 c_15_0) (near c_15_1 c_15_2) (near c_15_2 c_15_1) (near c_15_2 c_15_3) (near c_15_3 c_15_2) (near c_15_3 c_15_4) (near c_15_4 c_15_3) (near c_15_4 c_15_5) (near c_15_5 c_15_4) (near c_15_5 c_15_6) (near c_15_6 c_15_5) (near c_15_6 c_15_7) (near c_15_7 c_15_6) (near c_15_7 c_15_8) (near c_15_8 c_15_7) (near c_15_8 c_15_9) (near c_15_9 c_14_9) (near c_15_9 c_15_8) (near c_15_9 c_16_9) (near c_15_9 c_15_10) (near c_15_10 c_15_9) (near c_15_10 c_15_11) (near c_15_11 c_15_10) (near c_15_11 c_15_12) (near c_15_12 c_15_11) (near c_15_12 c_15_13) (near c_15_13 c_15_12) (near c_15_13 c_15_14) (near c_15_14 c_15_13) (near c_15_14 c_15_15) (near c_15_15 c_15_14) (near c_15_15 c_15_16) (near c_15_16 c_15_15) (near c_15_16 c_15_17) (near c_15_17 c_15_16) (near c_15_17 c_15_18) (near c_15_18 c_15_17) (near c_16_9 c_15_9) (near c_16_9 c_17_9) (near c_17_0 c_17_1) (near c_17_1 c_17_0) (near c_17_1 c_17_2) (near c_17_2 c_17_1) (near c_17_2 c_17_3) (near c_17_3 c_17_2) (near c_17_3 c_17_4) (near c_17_4 c_17_3) (near c_17_4 c_17_5) (near c_17_5 c_17_4) (near c_17_5 c_17_6) (near c_17_6 c_17_5) (near c_17_6 c_17_7) (near c_17_7 c_17_6) (near c_17_7 c_17_8) (near c_17_8 c_17_7) (near c_17_8 c_17_9) (near c_17_9 c_16_9) (near c_17_9 c_17_8) (near c_17_9 c_18_9) (near c_17_9 c_17_10) (near c_17_10 c_17_9) (near c_17_10 c_17_11) (near c_17_11 c_17_10) (near c_17_11 c_17_12) (near c_17_12 c_17_11) (near c_17_12 c_17_13) (near c_17_13 c_17_12) (near c_17_13 c_17_14) (near c_17_14 c_17_13) (near c_17_14 c_17_15) (near c_17_15 c_17_14) (near c_17_15 c_17_16) (near c_17_16 c_17_15) (near c_17_16 c_17_17) (near c_17_17 c_17_16) (near c_17_17 c_17_18) (near c_17_18 c_17_17) (near c_18_9 c_17_9) (near c_18_9 c_19_9) (near c_19_0 c_19_1) (near c_19_1 c_19_0) (near c_19_1 c_19_2) (near c_19_2 c_19_1) (near c_19_2 c_19_3) (near c_19_3 c_19_2) (near c_19_3 c_19_4) (near c_19_4 c_19_3) (near c_19_4 c_19_5) (near c_19_5 c_19_4) (near c_19_5 c_19_6) (near c_19_6 c_19_5) (near c_19_6 c_19_7) (near c_19_7 c_19_6) (near c_19_7 c_19_8) (near c_19_8 c_19_7) (near c_19_8 c_19_9) (near c_19_9 c_18_9) (near c_19_9 c_19_8) (near c_19_9 c_19_10) (near c_19_10 c_19_9) (near c_19_10 c_19_11) (near c_19_11 c_19_10) (near c_19_11 c_19_12) (near c_19_12 c_19_11) (near c_19_12 c_19_13) (near c_19_13 c_19_12) (near c_19_13 c_19_14) (near c_19_14 c_19_13) (near c_19_14 c_19_15) (near c_19_15 c_19_14) (near c_19_15 c_19_16) (near c_19_16 c_19_15) (near c_19_16 c_19_17) (near c_19_17 c_19_16) (near c_19_17 c_19_18) (near c_19_18 c_19_17) (in c_11_4))      
    (:goal (in c_19_18))
)