---
layout: post
title: "Benchmarks Are Fanfiction With Numbers"
date: 2026-06-15 09:00:00 -0500
description: "A benchmark can become a staged story with a score attached when contamination, saturation, and synthetic data blur what is being measured."
tags: [ai-evaluation, benchmarks, synthetic-data, ai-safety]
categories: [notes]
featured: false
image: assets/img/blog/2026-05-30-benchmarks-are-fanfiction-with-numbers_1.webp
---

Benchmarks are stories pretending to be thermometers.

They create a miniature world, define what counts as success inside it, and attach a number to the outcome. That number can be useful. It can also become theater. Once a benchmark saturates, leaks into training data, or rewards a narrow script, the score stops measuring the world and starts measuring familiarity with the story.

That is why the phrase "fanfiction with numbers" is only half a joke. A benchmark may look empirical while quietly encoding genre conventions: what a good answer sounds like, what failure is allowed to be, what edge cases are visible, which language matters, and which forms of safety count.

The argument is not that benchmarks are useless. It is that benchmark realism has to be defended. Without contamination controls, fresh tasks, multilingual care, and adversarial validation, scores become lore.

## SWE-bench showed the failure mode in public

In February 2026, OpenAI announced that SWE-bench Verified no longer measured frontier coding capability well enough for its launches [[1]](#ref-1). The post named two problems. First, an audit of 138 problems found that at least 59.4% of the audited cases had flawed tests or problem descriptions that could reject functionally correct solutions. Second, OpenAI reported evidence that frontier models could reproduce task-specific information from the benchmark, suggesting contamination [[1]](#ref-1).

That matters beyond coding. SWE-bench was valuable because it felt closer to real work than trivia benchmarks. It used GitHub issues, repositories, tests, and patches. Yet it still ran into the classic problems: tests can be too narrow, tasks can be underspecified, and public data can leak into training.

The lesson is uncomfortable. A benchmark can become famous because it is good, then become less useful because fame makes it unavoidable.

## Contamination is not only memorization

People often imagine contamination as exact answer memorization. That is too narrow.

OpenAI's analysis describes models producing gold-patch-like details or task-specific information when probed [[1]](#ref-1). LessLeak-Bench studies leakage across software engineering benchmarks and proposes a benchmark built by removing leaked samples from 83 SE benchmarks [[2]](#ref-2). The broader issue is that exposure can take many forms: code, issue text, patch discussions, release notes, blog posts, leaderboard discourse, and synthetic variants.

The model does not need to memorize the answer verbatim for the score to become inflated. It may have seen enough of the surrounding world to infer the hidden test's expectations. It may know the library's historical fix. It may recognize a benchmark pattern. It may have been trained on synthetic examples that preserve the structure of the evaluation.

That is why contamination is not a binary condition. It is a gradient of unfair familiarity.

## Safety benchmarks have a harder problem

Safety evaluation is even messier than coding evaluation. A coding task can often be checked by tests, even when the tests are imperfect. Safety tasks involve intent, context, harm, refusal quality, cultural framing, language, and possible dual use.

The International AI Safety Report 2026 warns that evaluation is central to risk assessment while also noting limitations around benchmarks, data contamination, and the difficulty of measuring real-world risks [[3]](#ref-3). A 2026 review of AI safety benchmarking argues that safety benchmarks need clearer design principles, better measurement of harms, and stronger qualitative and quantitative evaluation practices [[4]](#ref-4).

That creates a trap. Safety benchmarks are needed because intuition is not enough. But weak safety benchmarks can create a false sense of progress. A model can learn the expected refusal style without becoming safer in messy deployment. It can improve on English prompts while failing in translated variants. It can pass known red-team categories while missing new compositions.

This is where multilingual work matters. Translating a benchmark is not a clerical task. It changes idiom, ambiguity, cultural reference, politeness, and harm framing. A translated safety dataset may reveal failures that the original benchmark hid. It may also introduce new artifacts if translation choices become too uniform.

## Synthetic data is fermented reality

Synthetic data is often discussed as fake data. That framing is weak. A better metaphor is fermentation. The source material is transformed by a process that can preserve, amplify, or distort.

Synthetic data can help safety evaluation scale. It can create variants, cover rare cases, and test model behavior across languages or styles. It can also launder benchmark structure into training data. If a synthetic generator has seen the benchmark, or if the synthetic examples are too close to the evaluation distribution, the resulting model may learn the test's flavor rather than the underlying capability.

Research on hierarchical contamination detection for synthetic training data argues that benchmark contamination can persist beyond surface similarity and requires deeper detection methods [[5]](#ref-5). That is a crucial point. Removing exact duplicates is not enough when generated examples can paraphrase, translate, compress, or reframe the same evaluation logic.

For a multilingual safety dataset, the problem becomes more delicate. The same harm category may need different phrasing across languages. But if every translation preserves the same template structure, models may learn a multilingual benchmark accent rather than the intended safety concept.

## The benchmark needs an adversary

A credible benchmark should expect someone to overfit it.

That adversary may be a model provider optimizing for leaderboard scores. It may be an open-source community tuning prompts. It may be a synthetic data pipeline accidentally reproducing evaluation structure. It may be the benchmark creators themselves, unconsciously encoding their preferred answer style.

Defending against that requires process:

- fresh task splits where possible;
- contamination audits against training and synthetic corpora;
- hidden or rotating evaluation items for high-stakes claims;
- multilingual review by humans who understand the target language context;
- acceptance of qualitative error analysis alongside scores;
- public reporting of benchmark limits, not only model ranks.

This sounds slower than posting a leaderboard. It is. The leaderboard is the dessert. The evaluation work is the kitchen.

## Numbers should make arguments answerable

The right defense of benchmarks is not that they reveal truth. It is that they make some claims answerable. A benchmark should force the builder to say what was measured, under what conditions, with what possible leakage, using what scoring rule, and against what failure modes.

When a benchmark cannot do that, the number becomes decorative. It gives the feeling of evidence without the burden of interpretation.

That is the danger for AI safety. A model with a better safety score may be safer. It may also be better at the benchmark's dialect. The difference matters when systems move into agents, companions, tutors, clinical settings, or security workflows.

The work ahead is less glamorous than a new high score. It is provenance, contamination analysis, fresh evaluation design, multilingual review, and refusal to pretend that one number can summarize a model's moral behavior.

Fanfiction is not bad. It only becomes dangerous when someone mistakes it for a map.

## Multilingual safety makes the story stranger

Safety benchmarks become especially fragile when they cross languages.

A harmful request in English may be direct, ironic, euphemistic, bureaucratic, or slang-heavy. A translated version can preserve the literal intent while losing the social signal. It can also add a signal that was absent in the source. Politeness, legal vocabulary, taboo terms, and implied roles vary across languages. A refusal that sounds firm in English may sound rude, evasive, or absurd elsewhere.

This matters for multilingual safety datasets. The goal is not to produce perfect sentence pairs. The goal is to test whether a model can recognize and handle harmful intent across linguistic and cultural surfaces. That requires translation, review, and sometimes adaptation. It also requires humility about what the benchmark claims.

A multilingual safety score can mean several things:

- the model recognizes translated harm categories;
- the model learned benchmark templates across languages;
- the translation preserved enough intent to be useful;
- the refusal style transfers across languages;
- the evaluation rewards English-shaped safety norms rendered in another language.

Those are not the same claim.

This is why dataset cards, translation notes, and provenance are not paperwork. They are part of the measurement. A benchmark without provenance asks the reader to trust the number. A benchmark with provenance lets the reader inspect the story behind the number.

## A better benchmark is more like a courtroom

A good benchmark should not behave like a scoreboard alone. It should behave like a courtroom record.

The claim is presented. The evidence is described. The method is visible. The limitations are admitted. The opposing theory is considered. The decision can be appealed when new evidence appears.

For AI safety, that means a benchmark should publish what it is not measuring. It should say whether prompts are synthetic, translated, adversarially written, user-derived, or expert-authored. It should say whether model providers may have seen the data. It should say what answer styles are rewarded. It should include representative failures, not only aggregate scores.

OpenAI's SWE-bench Verified note is valuable partly because it publicly retired confidence in a once-useful metric [[1]](#ref-1). That is rare and healthy. Evaluation culture needs more of that: the willingness to say a number used to be meaningful, then stopped.

Safety benchmarks should be designed with their own death in mind. If the field advances, the benchmark will saturate. If the benchmark becomes popular, it will leak. If models train on synthetic variants, it may become familiar by family resemblance. The benchmark should therefore have renewal paths: fresh items, hidden validation, contamination checks, and qualitative review.

The benchmark that cannot be retired will eventually become mythology.

## What builders should publish with the score

A model card that reports a benchmark score should include enough context for the number to be interpreted.

For safety benchmarks, that means publishing the evaluation prompt policy, refusal grading rubric, languages covered, source of examples, synthetic generation method if any, human review process, contamination checks, and known failure categories. If the benchmark includes translated examples, the report should name whether translation was literal, adaptive, expert-reviewed, or model-generated.

If the benchmark is used for a public claim, the claim should be narrow. "This model scored 92 on benchmark X" is acceptable if X is described. "This model is safe" is not. Safety is not a scalar property. It is a set of behaviors under deployment conditions.

The same discipline applies to dataset releases. A multilingual safety dataset should publish enough provenance that future users can decide whether it is suitable for training, evaluation, red-teaming, or qualitative analysis. These uses are not interchangeable. Training on an evaluation-style dataset may improve safety behavior, but it can also reduce the dataset's future value as an independent test.

The practical rule is simple: if a dataset can improve the model, it can also contaminate the measurement. That does not make the dataset bad. It means the label "benchmark" should be earned continuously.

## What would falsify the argument

The argument would weaken if benchmark scores consistently predicted real deployment outcomes across domains, languages, and model families. If a high score on a safety benchmark reliably meant safer behavior in messy user contexts, then the theatrical critique would be overstated.

That is an empirical question. It requires longitudinal studies connecting benchmark performance to incident rates, human review, red-team outcomes, and deployment behavior. The International AI Safety Report emphasizes the importance of evaluations while also warning about their limitations [[3]](#ref-3). That is the right posture: use benchmarks, then keep testing the benchmark.

The argument would also weaken if contamination detection became reliable enough to certify that evaluation data had not influenced training. LessLeak-Bench and related work suggest the field is moving toward better leakage analysis [[2]](#ref-2). That progress matters. A benchmark with strong contamination controls is much less fictional.

The critique is therefore not anti-benchmark. It is anti-mystique. Benchmarks should survive cross-examination. If a score cannot explain what it measures, how it might be contaminated, and where it fails, the number is doing rhetorical work it has not earned.

## The Personaxis angle

Persona evaluation will face the same temptation as safety evaluation: turn a messy behavioral claim into a single number.

That will be seductive. A persona fidelity score sounds useful. A refusal alignment score sounds useful. A memory-governance score sounds useful. Each can be useful if the benchmark is honest about its limits. Each can become theater if the score hides the conditions.

For Personaxis, the benchmark question should be framed carefully. The goal is not to prove that an agent "is" a persona in some metaphysical sense. The goal is to test whether the agent preserves declared behavioral commitments across contexts. Does it refuse what the persona says it should refuse? Does it use memory according to policy? Does it escalate uncertainty? Does it preserve tone without violating safety?

Those evaluations should include adversarial prompts, multilingual variants where relevant, and model-change regression tests. They should also publish failures. A persona benchmark that reports only a success score will quickly become another staged story.

Evaluation should make persona claims answerable, not decorative.

## Reader takeaway

The next time a model claims a safety score, ask what story the benchmark told. Was the data public? Was it translated? Was it synthetic? Could the model have seen nearby examples? Does the score include qualitative failures? Does it test behavior outside English? Was the benchmark retired or refreshed after saturation?

Those questions do not make the number useless. They make it interpretable. A benchmark should invite scrutiny. If scrutiny ruins the score, the score was already too fragile.

Numbers are useful when they discipline claims. They become fanfiction when they replace them.

The same discipline should apply to every future persona or safety benchmark: publish the limits before the leaderboard teaches everyone to ignore them.

## References

<a id="ref-1"></a>
**[1]** OpenAI. (2026). Why SWE-bench Verified no longer measures frontier coding capabilities. [Research note](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)

<a id="ref-2"></a>
**[2]** Li, et al. (2025). LessLeak-Bench: A first investigation of data leakage in LLMs across 83 software engineering benchmarks. [arXiv:2502.06215](https://arxiv.org/abs/2502.06215)

<a id="ref-3"></a>
**[3]** International Scientific Report on the Safety of Advanced AI. (2026). *International AI Safety Report 2026*. [PDF](https://internationalaisafetyreport.org/sites/default/files/2026-02/international-ai-safety-report-2026.pdf)

<a id="ref-4"></a>
**[4]** Rottger, et al. (2026). How should AI safety benchmarks benchmark safety? [arXiv:2601.23112](https://arxiv.org/abs/2601.23112)

<a id="ref-5"></a>
**[5]** Beyond Surface-Level Similarity: Hierarchical Contamination Detection for Synthetic Training Data in Foundation Models. (2025). [arXiv:2511.17602](https://arxiv.org/abs/2511.17602)
