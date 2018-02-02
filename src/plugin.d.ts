export interface World {
    [key: string]: any;
}
export type StepDefinitionCode = (this: World, ...stepArgs: any[]) => any;
export type StepDefinitionInitializer = () => void;

export default function registerCucumber(
	name: string,
	featureSource: string,
	...stepDefinitionInitializers: StepDefinitionInitializer[]
): void;

export function Given(pattern: RegExp | string, code: StepDefinitionCode): void;
export function Then(pattern: RegExp | string, code: StepDefinitionCode): void;
export function When(pattern: RegExp | string, code: StepDefinitionCode): void;

export interface CucumberInterface {
	registerCucumber(
		name: string,
		featureSource: string,
		...stepDefinitionInitializers: any[]
	): void;
	
	Given(pattern: RegExp | string, code: StepDefinitionCode): void;
	Then(pattern: RegExp | string, code: StepDefinitionCode): void;
	When(pattern: RegExp | string, code: StepDefinitionCode): void;
}
