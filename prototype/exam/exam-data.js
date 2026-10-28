/* Smart exam for MIT 6.036 Lecture 4: Logistic regression (video abB3fwfPy14). Every item cites a lecture timestamp (seconds).
   Rule: a wrong option carries `why`, the misconception it stands for. `variant` tests the same concept from a different angle. */
window.EXAM = {
  video: "abB3fwfPy14",
  title: "Logistic regression: check yourself",
  concepts: {
    uncertainty: "Showing uncertainty",
    sigmoid: "The sigmoid",
    boundary: "The 50-50 line",
    nll: "Scoring the guesses",
    reg: "Not being too sure"
  },
  questions: [
    {
      id: "q1", concept: "uncertainty", ts: 321,
      text: "A perceptron draws one hard boundary between “yes” and “no”. What does logistic regression add that the hard boundary cannot show?",
      options: [
        { id: "a", text: "A faster way to draw the same line.", why: "Speed is not the point. The line itself is the same kind of line." },
        { id: "b", text: "How sure the model is, including regions where it is not certain.", correct: true },
        { id: "c", text: "A curved boundary instead of a straight one.", why: "The boundary stays a straight line. What changes is that the output becomes a probability." },
        { id: "d", text: "Perfect separation of data that was mixed together.", why: "Mixed data stays mixed. The model just admits that some regions are uncertain." }
      ],
      explain: "The lecture points out that real data, like medical data, has regions where we are not sure. A hard boundary hides that, and a probability can show it.",
      mini: "Think about deciding whether to wear a coat. Very cold: always. Very warm: never. In between you are unsure. A hard line says “coat” or “no coat”. A probability says “probably coat”.",
      variant: {
        text: "In the coat example, as the temperature gets very high, the probability of wearing a coat gets closest to:",
        options: [
          { id: "a", text: "0%", correct: true },
          { id: "b", text: "50%", why: "50% is the unsure middle, not the warm end." },
          { id: "c", text: "100%", why: "100% is the very cold end of the curve." },
          { id: "d", text: "It stops being a probability.", why: "It stays a probability. It just gets very close to 0." }
        ],
        explain: "The curve goes smoothly from about 100% at low temperatures down to about 0% at high temperatures."
      }
    },
    {
      id: "q2", concept: "sigmoid", ts: 536,
      text: "What does the sigmoid (logistic) function σ(z) = 1 / (1 + e^−z) do to a very large negative score z?",
      options: [
        { id: "a", text: "It gives a number close to 0.", correct: true },
        { id: "b", text: "It gives a very large negative number.", why: "The sigmoid never leaves the range from 0 to 1, so it cannot return a large negative number." },
        { id: "c", text: "It gives a number close to 1.", why: "That happens for a very large positive score, the other end of the S." },
        { id: "d", text: "It gives exactly 0.5.", why: "0.5 is the middle of the S, which happens when the score is 0." }
      ],
      explain: "As z gets very low, e^−z gets huge, so 1 / (1 + e^−z) gets close to 0. The S-curve flattens at 0 on the left and at 1 on the right.",
      mini: "Try the slider in the lesson: drag the score far to the left and watch the output flatten near 0 without ever going below it.",
      variant: {
        text: "If the score θᵀx + θ₀ is exactly 0, what probability does the model give?",
        options: [
          { id: "a", text: "0", why: "Only a very low score gives something close to 0." },
          { id: "b", text: "1", why: "Only a very high score gives something close to 1." },
          { id: "c", text: "1/2", correct: true },
          { id: "d", text: "It cannot be worked out.", why: "It can: 1 / (1 + e^0) = 1/2." }
        ],
        explain: "At a score of 0, σ(0) = 1/2. The lecture uses this to define the 50-50 line."
      }
    },
    {
      id: "q3", concept: "boundary", ts: 967,
      text: "In logistic regression with two features, the equation θᵀx + θ₀ = 0 describes:",
      options: [
        { id: "a", text: "The line where the model is 100% sure of a “yes”.", why: "Certainty comes far from the line. On the line the model is the least sure." },
        { id: "b", text: "The points in the training data.", why: "The data are separate points. The equation describes the model’s own line." },
        { id: "c", text: "The line where the probability is exactly 1/2.", correct: true },
        { id: "d", text: "The place where the loss is zero.", why: "The loss depends on the data and the labels, not on this equation alone." }
      ],
      explain: "When θᵀx + θ₀ = 0, the sigmoid gives 1/2, so that equation draws the line where the model is exactly 50-50.",
      mini: "Picture a hill that rises from “no” on one side to “yes” on the other. The 50-50 line is the middle of the slope.",
      variant: {
        text: "According to the lecture, the classifier predicts +1 when:",
        options: [
          { id: "a", text: "θᵀx + θ₀ is less than or equal to 0.", why: "That side is where it predicts the other label, −1." },
          { id: "b", text: "θᵀx + θ₀ is greater than 0.", correct: true },
          { id: "c", text: "The loss is exactly 0.", why: "The prediction depends on which side of the line the point is on." },
          { id: "d", text: "The probability is exactly 1.", why: "The model almost never reaches exactly 1." }
        ],
        explain: "It predicts +1 when θᵀx + θ₀ > 0 and −1 otherwise, the same linear classifiers as earlier in the course."
      }
    },
    {
      id: "q4", concept: "nll", ts: 2018,
      text: "The lecture picks the weights that maximize the log of the probability instead of the probability itself. Why is that allowed?",
      options: [
        { id: "a", text: "The log makes every probability bigger.", why: "The log of a number between 0 and 1 is not bigger, it is below 0." },
        { id: "b", text: "The log is a monotonic function, so the same weights are best either way.", correct: true },
        { id: "c", text: "The two answers are slightly different but close enough.", why: "They are exactly the same weights, not an approximation." },
        { id: "d", text: "The probability cannot be maximized directly.", why: "It can. The log is used because it keeps the same best weights and is easier to work with." }
      ],
      explain: "Because the log keeps the order of the options, the weights that maximize the probability are exactly the ones that maximize its log.",
      mini: "If you rank runners by finishing time, or by the log of finishing time, the order is the same. The log only changes the numbers, not who wins.",
      variant: {
        text: "Why does the lecture then take the negative of the log probability?",
        options: [
          { id: "a", text: "To fit the loss framework, where lower is better.", correct: true },
          { id: "b", text: "To make the probabilities add up to 1.", why: "The probabilities already add up to 1. The negative changes none of that." },
          { id: "c", text: "To make the sigmoid steeper.", why: "The sigmoid is not changed by this step." },
          { id: "d", text: "Because logs are only defined for negative numbers.", why: "The log is defined for positive numbers. A probability is positive." }
        ],
        explain: "Earlier we talked about losses we want to be small. Taking the negative turns “make this as high as possible” into “make this as low as possible”."
      }
    },
    {
      id: "q5", concept: "reg", ts: 4044,
      text: "Why is a huge θ a problem, even though it makes the loss lower?",
      options: [
        { id: "a", text: "It makes the model claim more confidence than the data can justify.", correct: true },
        { id: "b", text: "It makes the program run slower.", why: "Speed is not the issue. The issue is the quality of what the model claims." },
        { id: "c", text: "It turns probabilities negative.", why: "Probabilities stay between 0 and 1 whatever θ is." },
        { id: "d", text: "It makes the boundary disappear.", why: "The boundary is still there. The probabilities are just pushed to extremes." }
      ],
      explain: "The lecture says a huge θ is too confident: you would need a lot of data to justify that level of certainty. Training happily raises θ because it lowers the loss, so we need a regularizer to push back.",
      mini: "A forecaster who always says “100% rain” or “0% rain” is easy to fool. We want some humility built in, and the regularizer adds it.",
      variant: {
        text: "What is a regularizer for?",
        options: [
          { id: "a", text: "To make training finish sooner.", why: "That is closer to early stopping, a different idea." },
          { id: "b", text: "To show that being too confident is a problem and a lot of data is needed to justify it.", correct: true },
          { id: "c", text: "To add more features to the data.", why: "Features are chosen separately. A regularizer acts on the weights." },
          { id: "d", text: "To replace the sigmoid.", why: "The sigmoid stays. The regularizer is added next to the loss." }
        ],
        explain: "The lecture frames a regularizer as a way to assert that there is such a thing as being too confident, so a lot of data is needed to overcome it."
      }
    }
  ]
};
