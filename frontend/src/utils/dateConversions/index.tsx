import { __ } from "@/utils/translations"
import { getDateObject, USER_DATE_FORMAT } from "./utils"

interface Props {
    date: string;
}
/**
 * Returns a date in the format that the user has set in their preferences (locale-aware)
 */
export const StandardDate = (props: Props) => {
    return getDateObject(props.date).format(USER_DATE_FORMAT)
}

/**
 * Returns a date in DD MMM YYYY format
 */
export const DateMonthYear = (props: Props) => {

    return getDateObject(props.date).format("Do MMMM YYYY")
}

/** Returns date and time with translated "at" (e.g. "1 January 2024 at 10:30 AM") */
export const DateMonthAtHourMinuteAmPm = (props: Props) => {
    const d = getDateObject(props.date)
    return d.format("Do MMMM") + " " + __("at") + " " + d.format("hh:mm A")
}

export const getTimePassed = (date: string) => {

    return getDateObject(date).fromNow()
}