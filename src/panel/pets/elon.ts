import { PetColor } from '../../common/types';
import { BasePetType } from '../basepettype';
import { States } from '../states';

export class Elon extends BasePetType {
    label = 'elon';
    static possibleColors = [PetColor.white];
    sequence = {
        startingState: States.sitIdle,
        sequenceStates: [
            {
                state: States.sitIdle,
                possibleNextStates: [
                    States.walkRight,
                    States.runRight,
                    States.swipe,
                ],
            },
            {
                state: States.walkRight,
                possibleNextStates: [States.walkLeft, States.runLeft],
            },
            {
                state: States.runRight,
                possibleNextStates: [States.walkLeft, States.runLeft],
            },
            {
                state: States.walkLeft,
                possibleNextStates: [States.sitIdle],
            },
            {
                state: States.runLeft,
                possibleNextStates: [States.sitIdle],
            },
            {
                state: States.chase,
                possibleNextStates: [States.idleWithBall],
            },
            {
                state: States.swipe,
                possibleNextStates: [States.sitIdle],
            },
            {
                state: States.idleWithBall,
                possibleNextStates: [
                    States.walkRight,
                    States.walkLeft,
                    States.runLeft,
                    States.runRight,
                    States.swipe,
                ],
            },
        ],
    };
    get emoji(): string {
        return '👨🏻‍💻';
    }
    get hello(): string {
        return ` That's my lesson for taking a vacation: Vacation will kill you.`;
    }
}

export const ELON_NAMES: ReadonlyArray<string> = [
    'Elon',
    'Elongator',
    'Elmo',
    'Space Karen',
    'Technoking'
];
