/* Smart exam for Stanford CS229 Lecture 3 (video het9HFqo1TQ). Every item cites a lecture timestamp (seconds).
   Rule: a wrong option carries `why`, the misconception it stands for. `variant` tests the same concept from a different angle. */
window.EXAM = {
  video: "het9HFqo1TQ",
  title: "Logistic regression: check yourself",
  concepts: {
    boundary: "Why a straight line fails",
    range: "Outputs as chances",
    sigmoid: "The sigmoid",
    prob: "Chances add up to 1",
    mle: "Maximum likelihood",
    ascent: "Gradient ascent"
  },
  questions: [
    {
      id: "q1", concept: "boundary", ts: 2687,
      text: "You fit a straight line to yes-or-no data and say “yes” whenever the line is above 0.5. Then someone adds one more clear “yes” example far to the right. What happens?",
      options: [
        { id: "a", text: "Nothing changes, because the new example agrees with the pattern.", why: "It feels safe because the new point fits the pattern. But a fitted line chases every point, so a far-away one tilts it." },
        { id: "b", text: "The line tilts, and the point where the answer flips moves, even though the pattern is still clear.", correct: true },
        { id: "c", text: "The model turns its outputs into chances between 0 and 1.", why: "That is what logistic regression does. A straight line does not change its kind of output." },
        { id: "d", text: "The model stops working until it is retrained from scratch.", why: "It keeps working, it just gives a worse answer. That is the problem." }
      ],
      explain: "In the lecture, one extra example moves the fitted line, and the 0.5 cut-off moves with it. That is why a straight line is a risky tool for yes-or-no questions.",
      mini: "Picture a ruler laid across dots. Add one dot far away and the ruler tilts toward it, even if that dot was an easy “yes”. Logistic regression bends the line into an S-shape, so far-away points matter much less.",
      variant: {
        text: "A model must give a chance that a message is spam. Which output makes no sense as a chance?",
        options: [
          { id: "a", text: "0.20", why: "A chance of 0.20 means 20%, which is fine." },
          { id: "b", text: "0.97", why: "A chance of 0.97 means 97%, which is fine." },
          { id: "c", text: "−0.30", correct: true },
          { id: "d", text: "0.50", why: "A chance of 0.50 means a coin flip, which is fine." }
        ],
        explain: "A chance must stay between 0 and 1. The lecture notes that a straight line can output values below 0 or above 1, which seems strange."
      }
    },
    {
      id: "q2", concept: "sigmoid", ts: 2846,
      text: "What does the sigmoid (logistic) function do to the score z?",
      options: [
        { id: "a", text: "It rounds z to exactly 0 or 1.", why: "Rounding is the later step of choosing a cut-off. The sigmoid itself gives smooth values in between." },
        { id: "b", text: "It squeezes any score, however large or small, into a value between 0 and 1.", correct: true },
        { id: "c", text: "It adds up the scores of all the training examples.", why: "Adding is a different operation. The sigmoid reshapes one score at a time." },
        { id: "d", text: "It divides the score by the number of training examples.", why: "That is an average, a different idea. The sigmoid has nothing to do with the number of examples." }
      ],
      explain: "The sigmoid forces the output to lie only between 0 and 1, so it can be read as a chance.",
      mini: "Try the slider in the lesson: push the score far left or far right and the output flattens out near 0 or 1 but never leaves that range.",
      variant: {
        text: "If the score z is exactly 0, what is the sigmoid’s output?",
        options: [
          { id: "a", text: "0", why: "That mixes up the score with the output. Only a very negative score gives an output near 0." },
          { id: "b", text: "0.5", correct: true },
          { id: "c", text: "1", why: "An output near 1 needs a large positive score." },
          { id: "d", text: "It cannot be worked out.", why: "It can: 1 / (1 + e^0) = 1 / 2." }
        ],
        explain: "At z = 0 the output is 1 / (1 + 1) = 0.5, the middle of the S-curve."
      }
    },
    {
      id: "q3", concept: "prob", ts: 3103,
      text: "A model says a tumor has a 10% chance of being malignant. What is the chance it is benign?",
      options: [
        { id: "a", text: "10%", why: "That repeats the same chance. The two outcomes are different, so their chances differ." },
        { id: "b", text: "50%", why: "50% would mean the model is undecided. Here it has told you something specific." },
        { id: "c", text: "It depends on more data about the patient.", why: "The model already gave its answer. With only two outcomes, one chance fixes the other." },
        { id: "d", text: "90%", correct: true }
      ],
      explain: "With two outcomes the chances must add up to 1, so 1 − 0.10 = 0.90. The lecture gives exactly this example.",
      mini: "Think of a pie with two slices. If one slice is 10% of the pie, the other slice is the rest, 90%.",
      variant: {
        text: "A spam filter says a message is spam with probability 0.8. What is the probability it is not spam?",
        options: [
          { id: "a", text: "0.2", correct: true },
          { id: "b", text: "0.8", why: "That is the chance of spam, not of not-spam." },
          { id: "c", text: "1.8", why: "A chance can never be above 1. Subtract from 1, do not add." },
          { id: "d", text: "0.5", why: "0.5 would mean undecided. The filter leans clearly toward spam." }
        ],
        explain: "1 − 0.8 = 0.2. The two chances always add up to 1."
      }
    },
    {
      id: "q4", concept: "mle", ts: 3372,
      text: "When we “train” logistic regression, what are we choosing the weights θ to do?",
      options: [
        { id: "a", text: "Make the training labels as probable as possible under the model.", correct: true },
        { id: "b", text: "Make the squared gap between each label and a straight line as small as possible.", why: "That is the goal for linear regression. Logistic regression uses a different goal, maximum likelihood." },
        { id: "c", text: "Make every prediction exactly 0.5.", why: "A model that always says 0.5 is undecided about everything and learns nothing." },
        { id: "d", text: "Use as few features as possible.", why: "Choosing fewer features is a different task. Training adjusts the weights, not the list of features." }
      ],
      explain: "The lecture picks θ by maximum likelihood: the weights under which the observed labels are most probable.",
      mini: "Imagine the model as a guesser. Good weights are the ones that, looking back at the real answers, make that guesser say: “yes, these are exactly the answers I expected.”",
      variant: {
        text: "Why does the lecture take the log of the likelihood?",
        options: [
          { id: "a", text: "To make the probabilities larger.", why: "The log makes numbers smaller or negative, not larger." },
          { id: "b", text: "To make the algebra simpler, because products turn into sums.", correct: true },
          { id: "c", text: "Because the likelihood would otherwise be negative.", why: "A likelihood is never negative. It is a product of chances between 0 and 1." },
          { id: "d", text: "To force the answer to be between 0 and 1.", why: "That is the sigmoid’s job, not the log’s." }
        ],
        explain: "The lecture says the log is taken to make the algebra a bit simpler. The best weights are the same either way."
      }
    },
    {
      id: "q5", concept: "ascent", ts: 3586,
      text: "Linear regression’s update has a minus sign, but logistic regression’s update in the lecture has a plus. Why?",
      options: [
        { id: "a", text: "It is a typo that is corrected later in the lecture.", why: "It is intentional and the lecture explains it." },
        { id: "b", text: "The learning rate is negative for logistic regression.", why: "The learning rate stays a small positive number. The sign comes from the direction we move." },
        { id: "c", text: "Here we maximize the log-likelihood, so we climb up the hill instead of down.", correct: true },
        { id: "d", text: "Logistic regression tries to minimize the error, just like linear regression.", why: "It maximizes the likelihood. Maximizing means climbing, which flips the sign." }
      ],
      explain: "Gradient descent walks down a hill to minimize. Here we want to maximize the log-likelihood, so we walk up: gradient ascent, with a plus sign.",
      mini: "Walking downhill to find a valley uses a minus. Walking uphill to find a summit uses a plus. Same walk, opposite direction.",
      variant: {
        text: "What is special about the log-likelihood of logistic regression, as the lecture explains?",
        options: [
          { id: "a", text: "It has many peaks, so you must start from several places.", why: "That describes a bumpy surface. This one is a single smooth hill." },
          { id: "b", text: "It has no peak at all.", why: "It does have one, and that peak is the best answer." },
          { id: "c", text: "It has a single peak, so there are no local optima to get stuck on.", correct: true },
          { id: "d", text: "It is always exactly flat.", why: "A flat surface would give no direction to climb." }
        ],
        explain: "It is concave: the only maximum is the global one, so climbing always reaches the best weights."
      }
    }
  ]
};
