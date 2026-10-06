// هذا الملف يتكفل بالبحث عن الدواء وعرض معلوماته داخل بطاقة النتيجة

let medications = [];

// نجيب بيانات الأدوية من ملف medications.json عند تحميل الصفحة
fetch('data/medications.json')
    .then(response => response.json())
    .then(data => {
        medications = data;
    })
    .catch(error => {
        console.error('حدث خطأ أثناء تحميل بيانات الأدوية:', error);
    });

// دالة بسيطة تنظف النص قبل المقارنة (تشيل المسافات الزايدة وتخلي الأحرف صغيرة)
function normalize(text) {
    return text.trim().toLowerCase();
}

// دالة البحث الرئيسية
function searchMedicine() {
    const input = document.querySelector('.content input');
    const resultBox = document.querySelector('.result');
    const query = normalize(input.value);

    // إذا الصندوق فاضي، ما نسوي شي
    if (query === '') {
        return;
    }

    // ندور بقائمة الأدوية عن أي دواء اسمه (بأي لغة) يطابق أو يحتوي على الكلمة المكتوبة
    const found = medications.find(med =>
        med.names.some(name => normalize(name).includes(query))
    );

    if (found) {
        resultBox.innerHTML = `
            <h3>${found.name_ar}</h3>
            <p><strong>التصنيف:</strong> ${found.category}</p>
            <p><strong>الاستخدام:</strong> ${found.usage}</p>
            <p><strong>الجرعة:</strong> ${found.dosage}</p>
            <p><strong>الآثار الجانبية:</strong> ${found.side_effects}</p>
            <p><strong>تحذيرات:</strong> ${found.warnings}</p>
        `;
    } else {
        resultBox.innerHTML = `<p>ما لقينا معلومات عن هذا الدواء. تأكدي من كتابة الاسم صح، أو جربي الاسم العلمي.</p>`;
    }

    // نظهر بطاقة النتيجة (كانت مخفية بـ display: none)
    resultBox.style.display = 'block';
}

// نربط الدالة بزر البحث، وكمان بمفتاح Enter داخل صندوق الكتابة
document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('.search-btn');
    const input = document.querySelector('.content input');

    button.addEventListener('click', searchMedicine);

    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            searchMedicine();
        }
    });
});
