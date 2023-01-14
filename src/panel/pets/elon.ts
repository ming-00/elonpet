import { elonColor } from '../../common/types';
import { BasePetType } from '../basepettype';
import { States, resolveState } from '../states';

export class Elon extends BasePetType {
    label = 'elon';
    static possibleColors = [elonColor.classic, elonColor.wario];
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

    swipe() {
        if (this.currentStateEnum === States.swipe) {
            return;
        }
        this.holdState = this.currentState;
        this.holdStateEnum = this.currentStateEnum;
        this.currentStateEnum = States.swipe;
        this.currentState = resolveState(this.currentStateEnum, this);
        const quotes = [
            "He's FIRED.",
            "Let that sink in.",
            "Due to inflation 420 has gone up by 69."
        ]
        this.showSpeechBubble(quotes[Math.floor(Math.random()*quotes.length)]);
    }
}

export const ELON_NAMES: ReadonlyArray<string> = [
    'Elongator',
    'Elmo',
    'Space Karen',
    'Technoking',
    'Elongated Muskrat',
    'Chief Twit'
];
