Project Idea

Product Concept

This project is a word-guessing assistant for learning purposes.

The user enters clues from a guessing game, such as:

* category
* known hints
* previous guesses
* similarity scores
* visible characters
* hidden text

The assistant analyzes the information and suggests possible answers.

Game Modes

1. Semantic Similarity Guessing

The player enters guesses, and the system shows how close each guess is to the hidden answer.

Example:

Clue: A four-character Chinese idiom related to time.
Guess: 光阴
Similarity: 84%

Possible answers:

光阴似箭
日月如梭
白驹过隙

2. Masked Description Guessing

The player sees a hidden description. When the player enters a character that appears in the text, that character is revealed.

Example:

这是一种□□□□，通常用于□□，在年轻人中非常流行。

The goal is to guess the final answer from the revealed text.

First Milestone

Build a simple web demo with manual input.

The web demo should include:

* clue input box
* guess history input
* analyze button
* candidate answer list
* simple explanation for each candidate