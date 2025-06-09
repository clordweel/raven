import React from "react";

function translate(
    txt: string, replace: any | null, context: string | null, hasComponent: true
): React.ReactNode;
function translate(
    txt: string, replace?: any, context?: string | null, hasComponent?: boolean
): string;

function translate(
    txt: string, replace?: any, context: string | null = null, hasComponent: boolean = false
): string | React.ReactNode {
    if (!txt || typeof txt != "string") return txt;

    const messages = window.frappe?.boot?.__messages;
    if (!messages) {
        console.warn("No messages found in window.frappe.boot.__messages");
        return txt;
    }

    let translated_text: string | React.ReactNode = "";
    let key = txt;
    if (context) {
        translated_text = messages[`${key}:${context}`];
    }
    if (!translated_text) {
        translated_text = messages[key] || txt;
    }
    if (replace && typeof replace === "object") {
        translated_text = format(translated_text as string, replace, hasComponent);
    }

    return translated_text;
}

function format(str: string, args: (string | number | React.ReactNode)[], hasComponent: boolean): string | (string | React.ReactNode)[] {
    if (!str || typeof str !== "string") return str;

    let unkeyed_index = 0;

    const parts: (string | React.ReactNode)[] = [];
    let lastIndex = 0;

    str.replace(/\{(\w*)\}/g, (match, key, offset) => {
        if (lastIndex < offset) {
            parts.push(str.slice(lastIndex, offset));
        }
        if (key === "") {
            key = unkeyed_index;
            unkeyed_index++;
        }
        let value = args[key as any];
        if (React.isValidElement(value)) {
            hasComponent = true;
            parts.push(value);
        } else if (value !== undefined) {
            parts.push(String(value));
        } else {
            parts.push(match);
        }
        lastIndex = offset + match.length;
        return match;
    });

    if (lastIndex < str.length) {
        parts.push(str.slice(lastIndex));
    }

    if (hasComponent) {
        return parts;
    } else {
        return parts.join("");
    }
}

export const __ = translate