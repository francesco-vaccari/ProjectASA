;; domain file: domain.pddl
(define (domain default)
    (:requirements :strips)
    (:predicates
        (cell ?x_y)
        (near ?x_y ?x_y)
        (in ?x_y)
    )
    
    (:action move
        :parameters (?from_x_y ?to_x_y)
        :precondition (and (in ?from_x_y) (cell ?to_x_y) (near ?from_x_y ?to_x_y))
        :effect (and (in ?to_x_y) (not (in ?from_x_y)))
    )
)