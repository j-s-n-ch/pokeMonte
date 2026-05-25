import { Input } from "@mui/material";
import React from "react";
import {
	clamp,
	formatWithComma,
	getFormatWithCommaPos,
} from "../../util/NumberUtil";
import type { NumericInputHandle, NumericInputProps } from "./NumericInput";
import PopperMenu from "./PopperMenu";

/**
 * An numeric input component for keyboard.
 */
const NumericInputKeyboard = React.memo(
	React.forwardRef<NumericInputHandle, NumericInputProps>(
		({ children, min, max, value, onChange, ...props }, ref) => {
			const [open, setOpen] = React.useState(false);
			const [focused, setFocused] = React.useState(false);
			const [rawText, setRawText] = React.useState(formatWithComma(value));
			const anchorRef = React.useRef<HTMLElement>(null);

			const minValue = min ?? 0;
			const maxValue = max ?? Number.MAX_SAFE_INTEGER;

			// popup is enabled when children is provided
			const popupEnabled = children !== undefined;

			const onChangeHandler = React.useCallback(
				(e: React.ChangeEvent<HTMLInputElement>) => {
					const inputEl = e.target;
					const selectionStart = inputEl.selectionStart;
					const originalValue = inputEl.value;

					const text = originalValue.replace(/,/g, "");
					if (text === "") {
						setRawText("");
						onChange(minValue);
						return;
					}

					const val = parseInt(text, 10);
					if (Number.isNaN(val)) {
						return;
					}
					const clampedVal = clamp(minValue, val, maxValue);
					const formatted = formatWithComma(clampedVal);
					setRawText(formatted);
					onChange(clampedVal);

					if (selectionStart !== null) {
						// Calculate number of digits before the cursor in the original typed text
						const textBeforeCursor = originalValue.slice(0, selectionStart);
						const digitPos = textBeforeCursor.replace(/,/g, "").length;

						// Find the corresponding position in the newly formatted value
						const newPosition = getFormatWithCommaPos(clampedVal, digitPos);

						// Restore selection range in the next frame to prevent cursor jump
						requestAnimationFrame(() => {
							inputEl.setSelectionRange(newPosition, newPosition);
						});
					}
				},
				[minValue, maxValue, onChange],
			);

			const onFocus = React.useCallback(() => {
				setFocused(true);
				if (children !== undefined) {
					setOpen(true);
				}
				setRawText(formatWithComma(value));
			}, [children, value]);

			const onClose = React.useCallback(() => {
				// Parse and normalize the value when losing focus
				let normalizedVal: number;
				const text = rawText.replace(/,/g, "");
				if (text === "") {
					normalizedVal = minValue;
				} else {
					const val = parseInt(text, 10);
					if (Number.isNaN(val)) {
						// If invalid, keep the current value
						normalizedVal = value;
					} else {
						// Clamp to min/max range
						normalizedVal = clamp(minValue, val, maxValue);
					}
				}
				onChange(normalizedVal);
				setRawText(formatWithComma(normalizedVal));
				setFocused(false);
				setOpen(false);
			}, [rawText, value, minValue, maxValue, onChange]);

			const onBlur = React.useCallback(() => {
				if (popupEnabled) {
					return;
				}
				onClose();
			}, [onClose, popupEnabled]);

			// Handle Tab key to close popup
			const onKeyDown = React.useCallback(
				(e: React.KeyboardEvent<HTMLInputElement>) => {
					if (e.key === "Tab" && open) {
						onClose();
					}
				},
				[onClose, open],
			);

			// Sync rawText when value changes from outside or popup
			React.useEffect(() => {
				if (!anchorRef.current?.querySelector("input")?.matches(":focus")) {
					setRawText(formatWithComma(value));
				}
			}, [value]);

			// Expose focus and close methods to parent via ref
			React.useImperativeHandle(
				ref,
				() => ({
					focus: () => {
						anchorRef.current?.querySelector("input")?.focus();
					},
					close: onClose,
				}),
				[onClose],
			);

			const text = focused ? rawText : formatWithComma(value);

			return (
				<div className="numeric keyboard">
					<Input
						{...props}
						type="text"
						slotProps={{
							input: {
								sx: {
									"&::-webkit-outer-spin-button, &::-webkit-inner-spin-button":
										{
											WebkitAppearance: "none",
											margin: 0,
										},
									MozAppearance: "textfield",
								},
								min,
								max,
							},
						}}
						inputProps={{ inputMode: "numeric" }}
						value={text}
						ref={anchorRef}
						onChange={onChangeHandler}
						onFocus={onFocus}
						onBlur={onBlur}
						onKeyDown={onKeyDown}
					/>
					<PopperMenu
						open={open}
						anchorEl={anchorRef.current}
						onClose={onClose}
					>
						<div>{children}</div>
					</PopperMenu>
				</div>
			);
		},
	),
);

export default NumericInputKeyboard;
