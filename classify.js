/*
 * classify.js — rule/keyword-based classification for voice logs.
 *
 * Deliberately isolated from app.js so the heuristics can be tweaked or
 * replaced (e.g. with a real NLP model or API call) without touching the
 * capture/storage/UI code. Everything is exposed on a single global,
 * `window.VoiceLogClassifier`, since this project has no build step/bundler.
 */
(function (global) {
  'use strict';

  const CATEGORY = { DIARY: 'diary', REMINDER: 'reminder', OTHER: 'other' };
  const TAG = { WORK: 'work', PERSONAL: 'personal' };

  // Phrases that strongly suggest the log is a task/reminder to act on.
  const REMINDER_PHRASES = [
    'remind me', 'reminder to', 'reminder that', "don't forget", 'do not forget',
    'need to', 'have to', 'must remember', 'make sure to', 'make sure i',
    'note to self to', 'todo', 'to-do', 'to do:', 'schedule a', 'schedule an',
    'appointment', 'deadline is', 'deadline for', 'due by', 'due on', 'due at',
    'book a', 'book an', 'follow up on', 'follow up with', "i need", "i've got to",
    "i've gotta", 'gotta', 'pick up', 'drop off', 'pay the', 'renew', 'submit the'
  ];

  // Phrases that suggest reflective/narrative diary content.
  const DIARY_PHRASES = [
    'today i', 'today was', 'today has been', 'this morning', 'this afternoon',
    'this evening', 'i felt', 'i feel', 'i was feeling', 'i think', 'i thought',
    'i realized', 'i realised', 'dear diary', 'reflecting on', 'looking back',
    'i am grateful', "i'm grateful", 'i am thankful', "i'm thankful", 'my day',
    'yesterday i', 'tonight i', 'i had a', 'it was a good day', 'it was a bad day',
    'i enjoyed', 'i loved', 'i hated', 'i struggled with', 'i learned', 'i learnt'
  ];

  const WORK_KEYWORDS = [
    'meeting', 'client', 'deadline', 'project', 'boss', 'colleague', 'coworker',
    'co-worker', 'email', 'report', 'presentation', 'standup', 'stand-up',
    'sprint', 'ticket', 'jira', 'invoice', 'budget', 'manager', 'office',
    'conference call', 'zoom call', 'teams call', 'slack', 'interview',
    'promotion', 'salary', 'quarterly', 'kpi', 'stakeholder', 'contract',
    'proposal', 'workplace', 'work', 'coworkers', 'shift', 'timesheet',
    'performance review', 'onboarding', 'recruiter'
  ];

  const PERSONAL_KEYWORDS = [
    'family', 'friend', 'mom', 'mum', 'dad', 'wife', 'husband', 'partner',
    'girlfriend', 'boyfriend', 'kids', 'children', 'son', 'daughter', 'gym',
    'workout', 'vacation', 'holiday', 'dinner', 'movie', 'weekend', 'birthday',
    'anniversary', 'doctor', 'dentist', 'grocery', 'groceries', 'house', 'home',
    'pet', 'dog', 'cat', 'hobby', 'relax', 'sleep', 'date night', 'wedding',
    'road trip', 'hangout', 'hang out'
  ];

  // Ordered so more specific patterns (explicit times) are tried before
  // vaguer ones (bare weekday names), since we return the first match.
  const DATE_TIME_PATTERNS = [
    /\b\d{1,2}:\d{2}\s?(am|pm)?\b/i,
    /\b\d{1,2}\s?(am|pm)\b/i,
    /\b([01]?\d|2[0-3]):([0-5]\d)\b/,
    /\b\d{4}-\d{2}-\d{2}\b/,
    /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/,
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(st|nd|rd|th)?\b/i,
    /\b\d{1,2}(st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i,
    /\b(mon|tues|wednes|thurs|fri|satur|sun)day\b/i,
    /\btomorrow\b/i,
    /\btonight\b/i,
    /\bnext\s+(week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\bthis\s+(weekend|afternoon|evening|morning)\b/i
  ];

  function containsAny(text, phrases) {
    return phrases.some((p) => text.includes(p));
  }

  function countMatches(text, keywords) {
    return keywords.reduce((count, kw) => count + (text.includes(kw) ? 1 : 0), 0);
  }

  /** Returns the first recognisable date/time fragment found in the text, or null. */
  function extractDateTimeText(rawText) {
    const text = String(rawText || '');
    for (const pattern of DATE_TIME_PATTERNS) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    return null;
  }

  /** Classifies a log's category: 'reminder' | 'diary' | 'other'. */
  function classifyCategory(rawText) {
    const text = String(rawText || '').toLowerCase();
    const hasReminderPhrase = containsAny(text, REMINDER_PHRASES);
    const hasDiaryPhrase = containsAny(text, DIARY_PHRASES);
    const hasDateTime = extractDateTimeText(text) !== null;

    // Explicit reminder language wins outright. Otherwise, a bare date/time
    // mention (without diary framing) reads as a scheduling note.
    if (hasReminderPhrase) return CATEGORY.REMINDER;
    if (hasDateTime && !hasDiaryPhrase) return CATEGORY.REMINDER;
    if (hasDiaryPhrase) return CATEGORY.DIARY;
    return CATEGORY.OTHER;
  }

  /** Classifies a log's tag: 'work' | 'personal'. Defaults to 'personal' on a tie/no signal. */
  function classifyTag(rawText) {
    const text = String(rawText || '').toLowerCase();
    const workScore = countMatches(text, WORK_KEYWORDS);
    const personalScore = countMatches(text, PERSONAL_KEYWORDS);
    return workScore > personalScore ? TAG.WORK : TAG.PERSONAL;
  }

  /** Runs full classification, returning { category, tag, dateTimeText }. */
  function classifyLog(rawText) {
    return {
      category: classifyCategory(rawText),
      tag: classifyTag(rawText),
      dateTimeText: extractDateTimeText(rawText)
    };
  }

  global.VoiceLogClassifier = {
    CATEGORY,
    TAG,
    classifyCategory,
    classifyTag,
    extractDateTimeText,
    classifyLog
  };
})(window);
