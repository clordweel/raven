import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/zh-tw'
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(advancedFormat)
dayjs.extend(relativeTime)

const DEFAULT_TIME_ZONE = 'Asia/Kolkata'
//@ts-expect-error
export const SYSTEM_TIMEZONE = window.frappe?.boot?.time_zone?.system || DEFAULT_TIME_ZONE

/** Map Frappe lang to dayjs locale (e.g. zh -> zh-cn) */
const FRAPPE_LANG_TO_DAYJS: Record<string, string> = {
    'zh': 'zh-cn',
    'zh-cn': 'zh-cn',
    'zh-tw': 'zh-tw',
    'zh-hk': 'zh-tw',
}

let dayjsLocaleInitialized = false

/** Set dayjs locale from Frappe user language (for date/month/relative time translation) */
function initDayjsLocale() {
    if (dayjsLocaleInitialized) return
    //@ts-expect-error
    const frappeLang = (window.frappe?.boot?.lang || window.frappe?.boot?.user?.language || 'en') as string
    const dayjsLocale = FRAPPE_LANG_TO_DAYJS[frappeLang] || frappeLang
    try {
        dayjs.locale(dayjsLocale)
        dayjsLocaleInitialized = true
    } catch {
        dayjs.locale('en')
    }
}

//@ts-expect-error
export const USER_DATE_FORMAT = (window.frappe?.boot?.user?.defaults?.date_format?.toUpperCase() || window.frappe?.boot?.sysdefaults?.date_format?.toUpperCase()
    || 'DD/MM/YYYY')

export const FRAPPE_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'
export const FRAPPE_DATE_FORMAT = 'YYYY-MM-DD'
export const FRAPPE_TIME_FORMAT = 'HH:mm:ss'

export const getDateObject = (timestamp: string): dayjs.Dayjs => {
    initDayjsLocale()
    return dayjs.tz(timestamp, SYSTEM_TIMEZONE).local()
}

export const convertMillisecondsToReadableDate = (timestampInMilliseconds: number, format: string = 'hh:mm A (Do MMM)') => {

    return dayjs.unix(timestampInMilliseconds / 1000)
}

// Convert a Date object to Frappe datetime format string
export const convertDateToTimeString = (date: Date): string => {
    return dayjs(date).format(FRAPPE_DATETIME_FORMAT)
}