---
jupyter:
  jupytext:
    formats: ipynb,md
    text_representation:
      extension: .md
      format_name: markdown
      format_version: '1.3'
      jupytext_version: 1.11.1
  kernelspec:
    display_name: elections-models
    language: python
    name: elections-models
---

# Popularity of the president


This notebook is used to update the results of the president popularity model when new data arrives. We quickly validate the data, fit the model, run model diagnostics and export the data needed for the dashboard.

**We may want to run some analyses on the difference between the fit including the last data point and the previous fit.**

```python
import datetime
import warnings

import arviz
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import pymc3 as pm
import theano.tensor as aet
from dateutil.relativedelta import relativedelta
from scipy.special import expit as logistic

warnings.filterwarnings("ignore")
```

```python
# hide
RANDOM_SEED = 926
np.random.seed(RANDOM_SEED)
arviz.style.use("arviz-darkgrid")
```

## Load and clean the data

```python
data = pd.read_csv(
    "https://raw.githubusercontent.com/pollsposition/data/main/raw_popularity_presidents.csv",
    header=0,
    index_col=0,
    parse_dates=True,
)
```

```python
# Restrict data to after the switch to 5-year term
data = data.loc[data.index >= pd.to_datetime("2002-05-05")]
data["year"] = data.index.year
data["month"] = data.index.month

# Correct a few typos in the dataset
data["sondage"] = data["sondage"].replace("Yougov", "YouGov")
data["method"] = data["method"].replace("face-to-face&internet", "face to face")

# Convert approvals rates to proportion and compute total num approval
data[["approve_pr", "disapprove_pr"]] = (
    data[["approve_pr", "disapprove_pr"]].copy() / 100
)
data = data.rename(columns={"approve_pr": "p_approve", "disapprove_pr": "p_disapprove"})
data["num_approve"] = np.floor(data["samplesize"] * data["p_approve"]).astype("int")

# Reset the index
data = data.reset_index().rename(columns={"index": "field_date"})
```

Let's quickly summarize the data:

```python
POLLSTERS = data["sondage"].sort_values().unique()
comment = f"""The dataset contains {len(data)} polls between the years {data["year"].min()} and {data["year"].max()}.
There are {len(POLLSTERS)} pollsters: {', '.join(list(POLLSTERS))}
"""
print(comment)
```

## Sanity checks

We need to check that we haven't introduced any typos in the pollsters or methods, and do a quick visual check on the most recent approval values.

```python
pd.crosstab(data.sondage, data.method, margins=True)
```

Now let's plot the polls' results for Macron's term and highlight the last three points:

```python
approval = data.loc[data.president == "macron"]["p_approve"].values
dates = data.loc[data.president == "macron"].index

fig, ax = plt.subplots(figsize=(12, 8))
ax.plot(dates[:-3], approval[:-3], "o", color="grey", alpha=0.1)
ax.plot(dates[-3:], approval[-3:], "o", color="blue")
ax.set_ylim(0, 1)
ax.set_ylabel("Approval")
ax.set_xlabel("Date");
```

## Model


Let's prepare the data for the model:

```python
pollster_by_method_id, pollster_by_methods = data.set_index(
    ["sondage", "method"]
).index.factorize(sort=True)

month_id = np.hstack(
    [
        pd.Categorical(
            data[data.president == president].field_date.dt.to_period("M")
        ).codes
        for president in data.president.unique()
    ]
)
months = np.arange(max(month_id) + 1)
data["month_id"] = month_id

president_id, presidents = data["president"].factorize(sort=False)

COORDS = {
    "pollster_by_method": pollster_by_methods,
    "month": months,
    "month_minus_origin": months[1:],
    "president": presidents,
    "observation": data.set_index(["sondage", "field_date"]).index,
}
```

Define the `ZeroSumNormal` distribution

```python
from typing import *


def ZeroSumNormal(
    name: str,
    sigma: float = 1.0,
    *,
    dims: Union[str, Tuple[str]],
    model: Optional[pm.Model] = None,
):
    """
    Multivariate normal, such that sum(x, axis=-1) = 0.

    Parameters

    name: str
        String name representation of the PyMC variable.
    sigma: float, defaults to 1
        Scale for the Normal distribution. If none is provided, a standard Normal is used.
    dims: Union[str, Tuple[str]]
        Dimension names for the shape of the distribution.
        See https://docs.pymc.io/pymc-examples/examples/pymc3_howto/data_container.html for an example.
    model: Optional[pm.Model], defaults to None
        PyMC model instance. If ``None``, a model instance is created.

    Notes
    ----------
    Contributed by Adrian Seyboldt (@aseyboldt).
    """
    if isinstance(dims, str):
        dims = (dims,)

    model = pm.modelcontext(model)
    *dims_pre, dim = dims
    dim_trunc = f"{dim}_truncated_"
    (shape,) = model.shape_from_dims((dim,))
    assert shape >= 1

    model.add_coords({f"{dim}_truncated_": pd.RangeIndex(shape - 1)})
    raw = pm.Normal(
        f"{name}_truncated_", dims=tuple(dims_pre) + (dim_trunc,), sigma=sigma
    )
    Q = make_sum_zero_hh(shape)
    draws = aet.dot(raw, Q[:, 1:].T)

    return pm.Deterministic(name, draws, dims=dims)


def make_sum_zero_hh(N: int) -> np.ndarray:
    """
    Build a householder transformation matrix that maps e_1 to a vector of all 1s.
    """
    e_1 = np.zeros(N)
    e_1[0] = 1
    a = np.ones(N)
    a /= np.sqrt(a @ a)
    v = a + e_1
    v /= np.sqrt(v @ v)
    return np.eye(N) - 2 * np.outer(v, v)
```

And, finally, the model:

```python
with pm.Model(coords=COORDS) as hierarchical_popularity:

    baseline = pm.Normal("baseline")
    president_effect = ZeroSumNormal("president_effect", sigma=0.15, dims="president")
    house_effect = ZeroSumNormal("house_effect", sigma=0.15, dims="pollster_by_method")
    month_effect = ZeroSumNormal("month_effect", sigma=0.15, dims="month")

    # need the cumsum parametrization to properly control the init of the GRW
    rw_init = aet.zeros(shape=(len(COORDS["president"]), 1))
    rw_innovations = pm.Normal(
        "rw_innovations",
        dims=("president", "month_minus_origin"),
    )
    raw_rw = aet.cumsum(aet.concatenate([rw_init, rw_innovations], axis=-1), axis=-1)
    sd = pm.HalfNormal("shrinkage_pop", 0.2)
    month_president_effect = pm.Deterministic(
        "month_president_effect", raw_rw * sd, dims=("president", "month")
    )

    popularity = pm.math.invlogit(
        baseline
        + president_effect[president_id]
        + month_effect[month_id]
        + month_president_effect[president_id, month_id]
        + house_effect[pollster_by_method_id]
    )

    # overdispersion parameter
    theta = pm.Exponential("theta_offset", 1.0) + 10.0

    N_approve = pm.BetaBinomial(
        "N_approve",
        alpha=popularity * theta,
        beta=(1.0 - popularity) * theta,
        n=data["samplesize"],
        observed=data["num_approve"],
        dims="observation",
    )
```

```python
with hierarchical_popularity:
    idata = pm.sample(return_inferencedata=True)
```

Let's make sure the trace looks good:

```python
arviz.plot_trace(
    idata,
    var_names=["~truncated", "~rw_innovations"],
    filter_vars="regex",
    compact=True,
);
```

And check the number of effective samples and $\hat{R}$

```python
arviz.summary(
    idata,
    round_to=2,
    var_names=["~truncated", "~rw_innovations"],
    filter_vars="regex",
)
```

## Posterior estimations

Let's keep an eye on the biaises:

```python
mean_house_effect = (
    idata.posterior["house_effect"].mean(("chain", "draw")).to_dataframe()
)
ax = mean_house_effect.plot.bar(figsize=(14, 7), rot=30)
ax.set_xlabel("(pollster, method)")
ax.set_ylabel("house effect")
ax.set_title("$>0$ bias means (pollster, method) overestimates the latent popularity");
```

```python
data = data.merge(
    data.groupby(["year", "month"])["p_approve"].mean().reset_index(),
    on=["year", "month"],
    suffixes=["", "_mean"],
)
obs_mean = data.groupby(["president", "month_id"]).last()["p_approve_mean"].unstack().T

fig, axes = plt.subplots(2, 2, figsize=(14, 8), sharex=True, sharey=True)

for ax, p in zip(axes.ravel(), idata.posterior.coords["president"]):
    post = idata.posterior.sel(president=p)
    post_pop = logistic(
        (
            post["baseline"]
            + post["president_effect"]
            + post["month_effect"]
            + post["month_president_effect"]
        ).stack(sample=("chain", "draw"))
    )
    # plot random posterior draws
    ax.plot(
        post.coords["month"],
        post_pop.isel(
            sample=np.random.choice(post_pop.coords["sample"].size, size=1000)
        ),
        alpha=0.01,
        color="grey",
    )
    # plot posterior mean
    post_pop.mean("sample").plot(ax=ax, color="black", lw=2, label="predicted mean")
    # plot monthly raw polls
    ax.plot(
        obs_mean.index,
        obs_mean[p.data],
        "o",
        color="orange",
        alpha=0.8,
        label="observed monthly",
    )
    ax.set_xlabel("Months into term")
    ax.set_ylabel("Latent popularity")
    ax.legend()
```

## Posterior predictions

We look at the posterior predictive distributions, again to make sure that the model has correctly sampled.

```python
with hierarchical_popularity:
    idata.extend(
        arviz.from_pymc3(
            posterior_predictive=pm.sample_posterior_predictive(idata),
        )
    )
```

```python
predicted_approval_rates = (
    idata.posterior_predictive.mean(("chain", "draw"))["N_approve"] / data["samplesize"]
)
dates = predicted_approval_rates.field_date
newterm_dates = data.groupby("president").first()["field_date"].values


fig, ax = plt.subplots(figsize=(12, 4))
ax.plot(
    dates, data["p_approve"].values, "o", color="k", alpha=0.3, label="observed polls"
)
ax.plot(dates, predicted_approval_rates, "o", alpha=0.5, label="predicted polls")
ax.set_ylim(0.1, 0.8)
ax.set_title("Posterior Predictive Approval Rate")
ax.legend()
for date in newterm_dates:
    ax.axvline(date, color="k", alpha=0.6, linestyle="--")
```

### Aggregate per month and compute HDI

```python
pprob = idata.posterior_predictive["N_approve"][0, :] / np.atleast_2d(
    data["samplesize"]
)

# Limit ourselves to Macron's term
dates = pprob["field_date"].values
macron_first_date = np.min(data.loc[data.president == "macron"]["field_date"])
mask = dates >= macron_first_date
pprob = pprob[:, mask]
dates = dates[mask]

month_codes = pd.Categorical(pd.DataFrame(dates)[0].dt.to_period("M")).codes
```

```python
hdi_50_left = []
hdi_50_right = []
hdi_90_left = []
hdi_90_right = []
for month in set(month_codes):
    mask = month_codes == month
    probs_flat = pprob[:, mask].values.flatten()

    left, right = arviz.hdi(probs_flat, 0.5)
    hdi_50_left.append(left)
    hdi_50_right.append(right)

    left, right = arviz.hdi(probs_flat, 0.9)
    hdi_90_left.append(left)
    hdi_90_right.append(right)
```

## Export data

We export the data relative to Macron's term.


### Polls

```python
polls_macron = data.loc[data.president == "macron"][
    ["field_date", "sondage", "method", "samplesize", "p_approve", "p_disapprove"]
]
polls_macron.to_csv("../exports/polls_popularity.csv", index=False)
```

### Median, 50% HDI and 95% HDI


We first compute the posterior prediction of the latent popularity by summing all the effects but the house effects:

```python
post = idata.posterior.sel(president="macron")
post_pop = logistic(
    (
        post["baseline"]
        + post["president_effect"]
        + post["month_effect"]
        + post["month_president_effect"]
    ).stack(sample=("chain", "draw"))
)

means_macron = post_pop.mean("sample")  # Average posterior latent popularity
```

```python
dates = [datetime.date(2017, 5, 1) + relativedelta(months=i) for i in range(60)]

preds = pd.DataFrame(
    {
        "date": dates[: len(hdi_50_left)],
        "mean": means_macron[: len(hdi_50_left)],
        "hdi_50_left": hdi_50_left,
        "hdi_50_right": hdi_50_right,
        "hdi_90_left": hdi_90_left,
        "hdi_90_right": hdi_90_right,
    }
)
preds.to_csv("../exports/predictions_popularity.csv", index=False)
```

## Plot static curves

```python
max_month = np.max(
    pd.Categorical(data[data.president == "macron"].field_date.dt.to_period("M")).codes
)
```

```python
def plot_static_curve(president: str):
    post = idata.posterior.sel(president=president)
    means_president = 100 * logistic(
        (
            post["baseline"]
            + post["president_effect"]
            + post["month_effect"]
            + post["month_president_effect"]
        ).stack(sample=("chain", "draw"))
    ).mean("sample")

    post = idata.posterior.sel(president="macron")
    means_macron = 100 * logistic(
        (
            post["baseline"]
            + post["president_effect"]
            + post["month_effect"]
            + post["month_president_effect"]
        ).stack(sample=("chain", "draw"))
    ).mean("sample")

    fig, ax = plt.subplots(figsize=(16, 8))
    ax.plot(means_president, color="#3B4252", lw=3)
    ax.plot(means_macron[:max_month], color="#81A1C1", lw=3)
    ax.set_xticks([0, 12, 24, 36, 48, 60])
    ax.set_xticklabels(["", "1 AN", "2", "3", "4", "5"])
    ax.set_yticks([30, 50, 70])
    ax.set_yticklabels(["30%", "50%", "70%"])
    ax.set_ylim(10, 80)

    ax.xaxis.set_tick_params(labelsize=25, labelcolor="#D8DEE9")
    ax.yaxis.set_tick_params(labelsize=25, labelcolor="#D8DEE9")
    ax.get_yticklabels()[1].set_color("#3B4252")

    ax.spines["right"].set_visible(False)
    ax.spines["top"].set_visible(False)
    ax.spines["bottom"].set_visible(False)
    ax.spines["left"].set_visible(False)

    ax.axvline(0, alpha=0.1, color="grey")
    ax.axvline(11, alpha=0.1, color="grey")
    ax.axvline(23, alpha=0.1, color="grey")
    ax.axvline(35, alpha=0.1, color="grey")
    ax.axvline(47, alpha=0.1, color="grey")
    ax.axvline(59, alpha=0.1, color="grey")

    ax.axhline(30, alpha=0.1, color="grey")
    ax.axhline(50, alpha=1, color="black", lw=0.7)
    ax.axhline(70, alpha=0.1, color="grey")
    fig.tight_layout()
    plt.savefig(f"../exports/comparaison_{president}_macron.svg", bbox_inches="tight")
```

### Chirac 2

```python
plot_static_curve("chirac2")
```

```python
plot_static_curve("sarkozy")
```

```python
plot_static_curve("hollande")
```

```python
%load_ext watermark
%watermark -n -u -v -iv
```
