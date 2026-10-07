// هذا الملف يتكفل بالبحث الذكي عن الدواء وعرض معلوماته داخل بطاقة النتيجة

let medications = null;
let loadFailed = false;

// نجيب بيانات الأدوية من ملف data/medications.json عند تحميل الصفحة
fetch('data/medications.json')
    .then(response => {
        if (!response.ok) {
            throw new Error('HTTP error ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        medications = data;
    })
    .catch(error => {
        console.error('حدث خطأ أثناء تحميل بيانات الأدوية:', error);
        loadFailed = true;
    });

// دالة تطبيع النص العربي والإنجليزي قبل المقارنة
function normalize(text) {
    if (!text || typeof text !== 'string') return '';

    // 1. تحويل للأحرف الصغيرة وإزالة المسافات من الأطراف
    let str = text.toLowerCase().trim();

    // 2. إزالة التشكيل والحركات العربية
    str = str.replace(/[\u064B-\u065F\u0670]/g, '');

    // 3. إزالة التطويل (الكشيدة)
    str = str.replace(/\u0640/g, '');

    // 4. توحيد أشكال الألف (أ، إ، آ، ٱ) إلى ا
    str = str.replace(/[أإآٱ]/g, 'ا');

    // 5. توحيد التاء المربوطة (ة) إلى ه
    str = str.replace(/ة/g, 'ه');

    // 6. توحيد الألف المقصورة (ى) إلى ي
    str = str.replace(/ى/g, 'ي');

    // 7. استبدال علامات الترقيم والرموز بمسافة
    str = str.replace(/[()[\]{}*+?^$|\/\\.,;:!؟،"'-]/g, ' ');

    // 8. دمج المسافات المتكررة
    str = str.replace(/\s+/g, ' ');

    // 9. إزالة "ال" التعريف من بداية كل كلمة (إذا كانت الكلمة أطول من حرفين)
    str = str.split(' ').map(word => {
        if (word.startsWith('ال') && word.length > 2) {
            return word.slice(2);
        }
        return word;
    }).join(' ');

    return str.trim();
}

// دالة حساب مسافة التعديل (Levenshtein Distance)
function levenshtein(a, b) {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // استبدال
                    matrix[i][j - 1] + 1,     // إضافة
                    matrix[i - 1][j] + 1      // حذف
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// دالة عرض بطاقة الدواء
function showCard(med) {
    const resultBox = document.querySelector('.result');
    resultBox.innerHTML = `
        <h3>${med.name_ar}</h3>
        <p><strong>التصنيف:</strong> ${med.category}</p>
        <p><strong>الاستخدام:</strong> ${med.usage}</p>
        <p><strong>الجرعة:</strong> ${med.dosage}</p>
        <p><strong>الآثار الجانبية:</strong> ${med.side_effects}</p>
        <p><strong>تحذيرات:</strong> ${med.warnings}</p>
    `;
    resultBox.style.display = 'block';
}

// دالة عرض اقتراحات "هل تقصد"
function showSuggestions(suggestions) {
    const resultBox = document.querySelector('.result');
    let html = '<p><strong>هل تقصد:</strong></p><div class="suggestions">';
    suggestions.forEach((med, index) => {
        html += `<button type="button" class="suggestion-btn" data-index="${index}">${med.name_ar}</button>`;
    });
    html += '</div>';
    resultBox.innerHTML = html;
    resultBox.style.display = 'block';

    const buttons = resultBox.querySelectorAll('.suggestion-btn');
    buttons.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            showCard(suggestions[index]);
        });
    });
}

// دالة البحث الرئيسية
function searchMedicine() {
    const input = document.querySelector('.content input');
    const resultBox = document.querySelector('.result');

    // التحقق من تحميل البيانات
    if (!medications || medications.length === 0 || loadFailed) {
        resultBox.innerHTML = `<p>تعذر تحميل بيانات الأدوية. حدّث الصفحة وحاول مرة ثانية.</p>`;
        resultBox.style.display = 'block';
        return;
    }

    const query = normalize(input.value);

    // إذا كان البحث أقل من حرفين، لا نفعل شيئاً
    if (query.length < 2) {
        return;
    }

    // إذا كان البحث حرفين فقط: لا نظهر أي بطاقة ونكتفي برسالة "لا يوجد تطابق" إلا إذا كان تطابقاً تاماً مع اسم كامل
    if (query.length === 2) {
        const exactFullMatch = medications.find(med => {
            const fullNames = [med.name_ar, ...(med.names || [])];
            return fullNames.some(fn => normalize(fn) === query);
        });

        if (exactFullMatch) {
            showCard(exactFullMatch);
        } else {
            resultBox.innerHTML = `<p>ما لقينا معلومات عن هذا الدواء. تأكد من كتابة الاسم، أو جرّب الاسم العلمي.</p>`;
            resultBox.style.display = 'block';
        }
        return;
    }

    const exactMatches = [];
    const startsWithMatches = [];
    const containsMatches = [];
    const fuzzyMatches = [];

    medications.forEach(med => {
        const rawCandidates = [med.name_ar, ...(med.names || [])];
        const normalizedCandidates = [];

        rawCandidates.forEach(c => {
            const norm = normalize(c);
            if (norm) {
                normalizedCandidates.push({ str: norm, totalLen: norm.length });
                const words = norm.split(' ');
                if (words.length > 1) {
                    words.forEach(w => {
                        if (w.length >= 2) {
                            normalizedCandidates.push({ str: w, totalLen: norm.length });
                        }
                    });
                }
            }
        });

        let bestTier = Infinity; // 1: exact, 2: starts_with, 3: contains, 4: fuzzy
        let bestDistance = Infinity;
        let bestLengthDiff = Infinity;
        let bestCandidateTotalLen = Infinity;

        normalizedCandidates.forEach(({ str: cand, totalLen }) => {
            // 1. تطابق تام
            if (cand === query) {
                if (bestTier > 1 || totalLen < bestCandidateTotalLen) {
                    bestTier = 1;
                    bestDistance = 0;
                    bestLengthDiff = 0;
                    bestCandidateTotalLen = totalLen;
                }
            }
            // 2. يبدأ بـ
            else if (cand.startsWith(query)) {
                const diff = cand.length - query.length;
                if (bestTier > 2 || (bestTier === 2 && (diff < bestLengthDiff || totalLen < bestCandidateTotalLen))) {
                    bestTier = 2;
                    bestDistance = 0;
                    bestLengthDiff = diff;
                    bestCandidateTotalLen = totalLen;
                }
            }
            // 3. يحتوي على (فقط إذا كان طول البحث 3 أحرف فأكثر)
            else if (query.length >= 3 && cand.includes(query)) {
                const diff = cand.length - query.length;
                if (bestTier > 3 || (bestTier === 3 && (diff < bestLengthDiff || totalLen < bestCandidateTotalLen))) {
                    bestTier = 3;
                    bestDistance = 0;
                    bestLengthDiff = diff;
                    bestCandidateTotalLen = totalLen;
                }
            }
            // 4. تطابق تقريبي (Levenshtein) - مسموح من 4 أحرف فأكثر
            else if (query.length >= 4) {
                const maxAllowed = query.length <= 5 ? 1 : 2;
                if (Math.abs(cand.length - query.length) <= maxAllowed) {
                    const dist = levenshtein(query, cand);
                    if (dist <= maxAllowed) {
                        if (bestTier > 4 || (bestTier === 4 && (dist < bestDistance || (dist === bestDistance && totalLen < bestCandidateTotalLen)))) {
                            bestTier = 4;
                            bestDistance = dist;
                            bestLengthDiff = Math.abs(cand.length - query.length);
                            bestCandidateTotalLen = totalLen;
                        }
                    }
                }
            }
        });

        if (bestTier === 1) {
            exactMatches.push({ med, lengthDiff: bestLengthDiff, totalLen: bestCandidateTotalLen });
        } else if (bestTier === 2) {
            startsWithMatches.push({ med, lengthDiff: bestLengthDiff, totalLen: bestCandidateTotalLen });
        } else if (bestTier === 3) {
            containsMatches.push({ med, lengthDiff: bestLengthDiff, totalLen: bestCandidateTotalLen });
        } else if (bestTier === 4) {
            fuzzyMatches.push({ med, distance: bestDistance, lengthDiff: bestLengthDiff, totalLen: bestCandidateTotalLen });
        }
    });

    // 1. تطابق تام: إظهار البطاقة مباشرة
    if (exactMatches.length > 0) {
        exactMatches.sort((a, b) => a.totalLen - b.totalLen || a.lengthDiff - b.lengthDiff);
        showCard(exactMatches[0].med);
        return;
    }

    // 2. تطابق يبدأ بـ أو يحتوي على (فقط عند 3 أحرف فأكثر):
    // إذا تطابق أكثر من دواء، لا نظهر أي بطاقة ونعرض اقتراحات "هل تقصد:" (حتى 3 أزرار)
    // إذا تطابق دواء واحد فقط، نظهر بطاقته مباشرة
    const partialMatches = [];
    if (startsWithMatches.length > 0) {
        startsWithMatches.sort((a, b) => a.lengthDiff - b.lengthDiff || a.totalLen - b.totalLen);
        partialMatches.push(...startsWithMatches);
    }
    if (containsMatches.length > 0) {
        containsMatches.sort((a, b) => a.lengthDiff - b.lengthDiff || a.totalLen - b.totalLen);
        partialMatches.push(...containsMatches);
    }

    if (partialMatches.length === 1) {
        showCard(partialMatches[0].med);
        return;
    }

    if (partialMatches.length > 1) {
        const uniqueMeds = [];
        const seen = new Set();
        for (const item of partialMatches) {
            if (!seen.has(item.med.name_ar)) {
                seen.add(item.med.name_ar);
                uniqueMeds.push(item.med);
                if (uniqueMeds.length === 3) break;
            }
        }
        showSuggestions(uniqueMeds);
        return;
    }

    // 3. تطابق تقريبي فقط (Levenshtein): إظهار اقتراحات "هل تقصد:"
    if (fuzzyMatches.length > 0) {
        fuzzyMatches.sort((a, b) => a.distance - b.distance || a.totalLen - b.totalLen || a.lengthDiff - b.lengthDiff);
        const uniqueMeds = [];
        const seen = new Set();
        for (const item of fuzzyMatches) {
            if (!seen.has(item.med.name_ar)) {
                seen.add(item.med.name_ar);
                uniqueMeds.push(item.med);
                if (uniqueMeds.length === 3) break;
            }
        }
        showSuggestions(uniqueMeds);
        return;
    }

    // 4. لا يوجد تطابق
    resultBox.innerHTML = `<p>ما لقينا معلومات عن هذا الدواء. تأكد من كتابة الاسم، أو جرّب الاسم العلمي.</p>`;
    resultBox.style.display = 'block';
}

// ربط الأحداث عند تحميل DOM
document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('.search-btn');
    const input = document.querySelector('.content input');

    if (button) {
        button.addEventListener('click', searchMedicine);
    }

    if (input) {
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                searchMedicine();
            }
        });
    }
});
