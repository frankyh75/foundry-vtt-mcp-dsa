import { test, expect } from '@playwright/test';

test.describe('Entity-Namensextraktion', () => {
	test('IR von DeicherbeTest hat >50% sinnvolle Labels', async ({ request }) => {
		const response = await request.get('http://localhost:4174/sessions/DeicherbeTest/ir');
		expect(response.status()).toBe(200);
		const ir = await response.json();

		const candidates = ir.entityCandidates || [];
		expect(candidates.length).toBeGreaterThan(0);

		// Zähle Labels, die nicht OCR-Müll sind
		const goodLabels = candidates.filter((c: any) => {
			const label = c.label || '';
			// Mindestens 2 Zeichen, nicht nur Sonderzeichen/Zahlen
			if (label.length < 2) return false;
			if (/^[\W\d\s]+$/.test(label)) return false;
			// Keine riesigen Sätze
			if (label.length > 50) return false;
			// Muss mindestens einen Buchstaben enthalten
			if (!/[A-Za-zÄÖÜäöüß]/.test(label)) return false;
			return true;
		});

		const ratio = goodLabels.length / candidates.length;
		console.log(`Named: ${goodLabels.length}/${candidates.length} = ${(ratio * 100).toFixed(1)}%`);
		console.log('Good labels:', goodLabels.slice(0, 10).map((c: any) => c.label));
		console.log('Bad labels:', candidates.filter((c: any) => !goodLabels.includes(c)).slice(0, 5).map((c: any) => c.label));

		expect(ratio).toBeGreaterThanOrEqual(0.5);
	});

	test('DSA5-NPC-Namen werden erkannt', async ({ request }) => {
		const response = await request.get('http://localhost:4174/sessions/DeicherbeTest/ir');
		expect(response.status()).toBe(200);
		const ir = await response.json();

		const labels = (ir.entityCandidates || []).map((c: any) => c.label || '');

		// Typische DSA5-Namen die wir erwarten
		const expectedPatterns = [
			/Deichbauern/i,
			/Elidan/i,
			/Frengesfold/i,
		];

		let foundCount = 0;
		for (const pattern of expectedPatterns) {
			const found = labels.some((l: string) => pattern.test(l));
			if (found) {
				foundCount++;
				console.log(`Found: ${pattern.source}`);
			}
		}

		expect(foundCount).toBeGreaterThanOrEqual(2);
	});

});