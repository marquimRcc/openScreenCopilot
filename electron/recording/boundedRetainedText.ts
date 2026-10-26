export const WINDOWS_HELPER_OUTPUT_MAX_CODE_UNITS = 64 * 1024;

const TRUNCATION_MARKER = "\n[... helper output truncated ...]\n";

/**
 * Retains a fixed prefix and suffix once the configured UTF-16 code-unit ceiling is reached.
 * The ceiling describes JavaScript string length, not encoded bytes or process RSS.
 */
export class BoundedRetainedText {
	readonly #maxCodeUnits: number;
	readonly #prefixCodeUnits: number;
	readonly #suffixCodeUnits: number;
	#complete = "";
	#prefix = "";
	#suffix = "";
	#truncated = false;

	constructor(maxCodeUnits = WINDOWS_HELPER_OUTPUT_MAX_CODE_UNITS) {
		if (!Number.isSafeInteger(maxCodeUnits) || maxCodeUnits < TRUNCATION_MARKER.length) {
			throw new RangeError("maxCodeUnits must fit the truncation marker");
		}

		this.#maxCodeUnits = maxCodeUnits;
		const retainedCodeUnits = maxCodeUnits - TRUNCATION_MARKER.length;
		this.#prefixCodeUnits = Math.ceil(retainedCodeUnits / 2);
		this.#suffixCodeUnits = Math.floor(retainedCodeUnits / 2);
	}

	append(text: string): void {
		if (text.length === 0) return;

		if (!this.#truncated) {
			if (this.#complete.length + text.length <= this.#maxCodeUnits) {
				this.#complete += text;
				return;
			}

			this.#prefix = takePrefix(this.#complete, text, this.#prefixCodeUnits);
			this.#suffix = takeSuffix(this.#complete, text, this.#suffixCodeUnits);
			this.#complete = "";
			this.#truncated = true;
			return;
		}

		this.#suffix = takeSuffix(this.#suffix, text, this.#suffixCodeUnits);
	}

	value(): string {
		if (!this.#truncated) return this.#complete;
		return this.#prefix + TRUNCATION_MARKER + this.#suffix;
	}

	reset(): void {
		this.#complete = "";
		this.#prefix = "";
		this.#suffix = "";
		this.#truncated = false;
	}
}

function takePrefix(left: string, right: string, length: number): string {
	if (left.length >= length) return left.slice(0, length);
	return left + right.slice(0, length - left.length);
}

function takeSuffix(left: string, right: string, length: number): string {
	if (length === 0) return "";
	if (right.length >= length) return right.slice(-length);
	return left.slice(-(length - right.length)) + right;
}
