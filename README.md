# PollsPosition
> Forecasting elections with Bayesian inference

Dashboards for electoral forecasting models in [PyMC3](https://docs.pymc.io/).

This repository is a collection of dashboards displaying the results of electoral forecasting models implemented in PyMC3. For now, the models are focused on forecasting French elections.

- Gaussian Process regression to forecast how French presidents' approval evolves with time:
  - [Interactive dashboard](https://share.streamlit.io/alexandorra/pollsposition_website/main/gp-popularity-app.py)
  - [Tutorial notebook](https://alexandorra.github.io/pollsposition_blog/popularity/macron/gaussian%20processes/polls/2021/01/18/gp-popularity.html)

## What is it?

The models are [open-sourced](https://github.com/AlexAndorra/pollsposition_models) and stand on the shoulders of giants
of the [Python](https://www.python.org/) data stack:
[PyMC3](https://docs.pymc.io/) for state-of-the-art MCMC algorithms,
[ArviZ](https://arviz-devs.github.io/arviz/) and [Bokeh](https://docs.bokeh.org/en/latest/)
for visualizations, and [Pandas](https://pandas.pydata.org/) for data cleaning.

More details about the project as well as tutorials detailing how the models work are available [here](https://alexandorra.github.io/pollsposition_blog/about/).

We warmly thank all the developers who give their time to develop these free, open-source and high quality scientific
tools -- just like The Avengers, they really are true heroes.

## Who is it?

This project is maintained and spearheaded by [Alexandre Andorra](https://twitter.com/alex_andorra) and [Rémi Louf](https://twitter.com/remilouf).

By day, I'm a Bayesian modeler at the <a href="https://www.pymc-labs.io/" target="_blank">PyMC Labs consultancy</a> and
host the most popular podcast dedicated to Bayesian inference out there -- aka
<a href="https://www.learnbayesstats.com/" target="_blank"><i>Learning Bayesian Statistics</i></a>.

By night, I don't (yet) fight crime, but I'm an open-source enthusiast and core contributor to the awesome Python
packages <a href="https://docs.pymc.io/" target="_blank">PyMC</a>
and <a href="https://arviz-devs.github.io/arviz/" target="_blank">ArviZ</a>.

An always-learning statistician, I love building models and studying elections and human behavior. I also love Nutella a
bit too much, but I don't like talking about it – I prefer eating it 😋

Feel free to reach out on <a href="https://twitter.com/alex_andorra" target="_blank">Twitter</a> if you want to talk
about chocolate, statistical modeling under certainty, or how "polls are useless now because they missed two elections
in a row!" -- yeah, I'm a bit sarcastic.

On that note, go forth and PyMCheers :vulcan_salute: 
