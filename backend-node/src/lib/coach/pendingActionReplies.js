/**
 * User-facing replies after pending action confirm/cancel/execute.
 */

function cancelReply(locale) {
  return locale === 'ar'
    ? 'تم الإلغاء — لم أنفّذ أي إجراء.'
    : 'Cancelled — no action was taken.';
}

function expiredReply(locale) {
  return locale === 'ar'
    ? 'انتهت صلاحية التأكيد. كرّر طلبك من جديد.'
    : 'This confirmation expired. Please ask again.';
}

function notFoundReply(locale) {
  return locale === 'ar'
    ? 'لم أجد إجراءً معلّقاً للتأكيد.'
    : 'No pending action found to confirm.';
}

function useConfirmButtonReply(locale) {
  return locale === 'ar'
    ? 'استخدم زر «تأكيد» أو «إلغاء» أعلاه لتنفيذ هذا الإجراء بأمان.'
    : 'Use the Confirm or Cancel button above to run this action safely.';
}

function describeToolResult(toolName, result, locale) {
  if (!result?.success || !result?.output) return null;
  const out = result.output;
  const ar = locale === 'ar';

  if (toolName === 'log_food' && out.log?.foodItem) {
    const name = out.log.foodItem.name || '';
    const grams = out.log.grams;
    if (name && grams != null) {
      return ar ? `سجّلت ${name} (${grams} جم)` : `Logged ${name} (${grams}g)`;
    }
  }

  if (toolName === 'replace_exercise_today' && out.replaced && out.exercise) {
    const from = out.replaced.name || '';
    const to = out.exercise.name || out.exercise.nameAr || '';
    if (from && to) {
      return ar ? `استبدلت ${from} بـ ${to}` : `Replaced ${from} with ${to}`;
    }
  }

  if (toolName === 'set_life_mode' && out.lifeMode) {
    return ar ? `تم تفعيل وضع: ${out.lifeMode}` : `Life mode set to ${out.lifeMode}`;
  }

  if (toolName === 'adapt_plan' && out.applied) {
    return ar ? 'تم تطبيق تعديل على خطتك' : 'Plan adaptation applied';
  }

  return null;
}

function executionSuccessReply(toolNames, results, locale) {
  const lang = locale === 'ar' ? 'ar' : 'en';
  const lines = [];
  const names = toolNames || [];
  const rows = results || [];

  for (let i = 0; i < names.length; i += 1) {
    const detail = describeToolResult(names[i], rows[i], lang);
    if (detail) lines.push(detail);
  }
  if (lines.length) return lines.join('\n');

  const ok = rows.filter((r) => r.success).length;
  const total = rows.length;
  if (lang === 'ar') {
    if (ok === total && ok > 0) {
      return `تم التنفيذ بنجاح (${ok} ${ok === 1 ? 'أداة' : 'أدوات'}).`;
    }
    if (ok > 0) return `تم تنفيذ ${ok} من ${total}. تحقق من لوحة التحكم.`;
    return 'تعذّر تنفيذ الإجراء. حاول مرة أخرى أو عدّل الطلب.';
  }
  if (ok === total && ok > 0) {
    return `Done — ${ok} action${ok === 1 ? '' : 's'} completed successfully.`;
  }
  if (ok > 0) return `Partially completed (${ok}/${total}). Check your dashboard.`;
  return 'Could not complete the action. Try again or rephrase your request.';
}

module.exports = {
  cancelReply,
  expiredReply,
  notFoundReply,
  useConfirmButtonReply,
  executionSuccessReply,
  describeToolResult,
};
