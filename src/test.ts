import {assert} from './assertion';
import {assertionMessage, bailout, endTestMessage, startTestMessage} from './protocol';
import {counter, delegateToCounter} from './counter';
import {Assert, Test} from './interfaces';

export const defaultTestOptions = Object.freeze({
    offset: 0,
    skip: false
});

export const noop = () => {
};

export const tester = (description, spec, {offset = 0, skip = false} = defaultTestOptions): Test => {
    let id = 0;
    let pass = true;
    let executionTime = 0;
    let error = null;
    const testCounter = counter();
    const withTestCounter = delegateToCounter(testCounter);

    const assertions = [];
    const collect = item => assertions.push(item);
    const specFunction = skip === true ? noop : function zora_spec_fn() {
        return spec(assert(collect, offset));
    };

    const testRoutine = (async function () {
        try {
            const start = Date.now();
            const result = await specFunction();
            executionTime = Date.now() - start;
            return result;
        } catch (e) {
            error = e;
        }
    })();

    return Object.defineProperties(withTestCounter({
        [Symbol.asyncIterator]: async function* () {
            await testRoutine;
            for (const assertion of assertions) {
                assertion.id = ++id;
                if (assertion[Symbol.asyncIterator]) {
                    // Sub test
                    yield startTestMessage({description: assertion.description}, offset);
                    yield* assertion;
                    if (assertion.error !== null) {
                        // Bubble up the error and return
                        error = assertion.error;
                        pass = false;
                        return;
                    }
                }
                yield assertionMessage(assertion, offset);
                pass = pass && assertion.pass;
                testCounter.update(assertion);
            }

            return error !== null ?
                yield bailout(error, offset) :
                yield endTestMessage(this, offset);
        }
    }), {
        description: {
            enumerable: true,
            value: description
        },
        pass: {
            enumerable: true,
            get() {
                return pass;
            }
        },
        executionTime: {
            enumerable: true,
            get() {
                return executionTime;
            }
        },
        length: {
            get() {
                return assertions.length;
            }
        },
        error: {
            get() {
                return error;
            }
        },
        routine: {
            value: testRoutine
        },
        skip: {
            value: skip
        }
    });
};
